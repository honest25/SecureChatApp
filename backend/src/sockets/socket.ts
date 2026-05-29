import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../config/db';
import { redis } from '../config/redis';
import { env } from '../config/env';

interface AuthSocket extends Socket {
  user?: { userId: string };
}

let io: Server;

export const setupSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: function (origin: string | undefined, callback: (err: Error | null, origin?: boolean) => void) {
        const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:3000', 'http://192.168.1.35:3000', 'http://127.0.0.1:3000'];
        if (!origin || allowedOrigins.includes(origin) || origin.endsWith('vercel.app')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  // Socket Authentication Middleware
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.cookie?.split('access_token=')[1]?.split(';')[0];
      if (!token) return next(new Error('Authentication error: No token'));
      
      const payload = verifyAccessToken(token) as { userId: string };
      socket.user = payload as { userId: string };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthSocket) => {
    const userId = socket.user!.userId;
    console.log(`[Socket] User ${userId} connected`);

    // Track user status
    await redis.set(`user:online:${userId}`, 'true');
    await prisma.user.update({ where: { id: userId }, data: { is_online: true } });
    
    // Join a personal room for direct notifications
    socket.join(userId);

    // Broadcast online status to others (can be optimized to only friends)
    socket.broadcast.emit('user_status', { userId, isOnline: true });

    socket.on('join_chat', (chatId: string) => {
      socket.join(chatId);
      console.log(`[Socket] User ${userId} joined chat ${chatId}`);
    });

    socket.on('typing', ({ chatId, receiverId }) => {
      socket.to(chatId).emit('typing', { chatId, userId });
    });

    socket.on('stop_typing', ({ chatId, receiverId }) => {
      socket.to(chatId).emit('stop_typing', { chatId, userId });
    });

    socket.on('join_location_feed', (hostelName: string) => {
      socket.join(`feed:${hostelName}`);
      console.log(`[Socket] User ${userId} joined location feed for ${hostelName}`);
    });

    socket.on('leave_location_feed', (hostelName: string) => {
      socket.leave(`feed:${hostelName}`);
      console.log(`[Socket] User ${userId} left location feed for ${hostelName}`);
    });

    socket.on('update_gps_location', async (data: { lat: number, lon: number, hostelName: string }) => {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        // Find the building for this hostel
        const building = await prisma.building.findUnique({ where: { name: data.hostelName } });
        let roomId: string | null = null;
        let roomName: string | null = null;
        let roomNumber: string | null = null;

        if (building) {
          const { detectExactRoom } = require('../services/indoorLocationEngine');
          roomId = await detectExactRoom(data.lat, data.lon, building.id);
          if (roomId) {
            const detectedRoom = await prisma.room.findUnique({ where: { id: roomId } });
            if (detectedRoom) {
              roomName = detectedRoom.name;
              roomNumber = detectedRoom.room_number;
            }
          }
        }

        // Upsert LivePresence with precise GPS and dynamic roomId
        await prisma.livePresence.upsert({
          where: { user_id: userId },
          update: { 
            latitude: data.lat, longitude: data.lon, 
            room_id: roomId,
            method: 'GPS', updated_at: new Date() 
          },
          create: { 
            user_id: userId, 
            latitude: data.lat, longitude: data.lon, 
            room_id: roomId,
            method: 'GPS' 
          }
        });

        if (roomId) {
            await redis.setex(`presence:user:${userId}:room`, 15 * 60, roomId);
        } else {
            await redis.del(`presence:user:${userId}:room`);
        }

        // 1. Save strictly to Redis GEO index for Distance calculation
        const geoKey = `hostel:locations:${data.hostelName}`;
        await redis.geoadd(geoKey, data.lon, data.lat, userId);
        // Expirations for geo keys can be handled via a cleanup worker

        // 2. Fetch all nearby users within 5km radius
        const rawNearby = await redis.georadius(geoKey, data.lon, data.lat, 5000, 'm', 'WITHDIST') as unknown as [string, string][];
        
        // 3. Personalized Fan-out (Tell others about me, and collect them for me)
        const radarSyncList = [];
        
        for (const [otherUserId, distanceStr] of rawNearby) {
          if (otherUserId === userId) continue;
          
          const distanceMeters = Math.round(parseFloat(distanceStr));
          
          // Send personalized secure update TO the other user about me
          io.to(otherUserId).emit('nearby_user_update', {
            userId: user.id,
            userName: user.name,
            profile_pic_url: user.profile_pic_url,
            gender: user.gender,
            latitude: data.lat,
            longitude: data.lon,
            distanceMeters,
            roomId,
            roomName,
            roomNumber,
            timestamp: new Date()
          });

          radarSyncList.push({ id: otherUserId, distanceMeters });
        }

        // 4. Send bulk sync back TO ME so I know everyone's distance
        if (radarSyncList.length > 0) {
          const otherUserIds = radarSyncList.map(n => n.id);
          const otherUsers = await prisma.user.findMany({ 
            where: { id: { in: otherUserIds } },
            select: { id: true, name: true, gender: true, profile_pic_url: true }
          });
          
          const presences = await prisma.livePresence.findMany({ 
            where: { user_id: { in: otherUserIds } },
            include: { room: true }
          });

          const syncData = radarSyncList.map(radarUser => {
            const u = otherUsers.find(ou => ou.id === radarUser.id);
            const p = presences.find(op => op.user_id === radarUser.id);
            return {
              userId: u?.id,
              userName: u?.name,
              profile_pic_url: u?.profile_pic_url,
              gender: u?.gender,
              latitude: p?.latitude,
              longitude: p?.longitude,
              distanceMeters: radarUser.distanceMeters,
              roomId: p?.room_id || null,
              roomName: p?.room?.name || null,
              roomNumber: p?.room?.room_number || null,
              timestamp: p?.updated_at || new Date()
            };
          }).filter(u => u.userId);

          io.to(userId).emit('radar_bulk_sync', syncData);
        }

        // Echo my own roomId back so my simulator/radar knows my calculated room
        io.to(userId).emit('self_room_update', { roomId, roomName, roomNumber, timestamp: new Date() });

      } catch (err) {
        console.error('[Socket] Error updating GPS location', err);
      }
    });

    socket.on('send_message', async (data) => {
      // Data: { chatId, content, type, mediaUrl }
      const message = await prisma.message.create({
        data: {
          chat_id: data.chatId,
          sender_id: userId,
          content: data.content,
          type: data.type || 'TEXT',
          media_url: data.mediaUrl || null,
          file_name: data.fileName || null,
        }
      });

      // Emit to room
      io.to(data.chatId).emit('receive_message', message);
    });

    socket.on('disconnect', async () => {
      console.log(`[Socket] User ${userId} disconnected`);
      await redis.del(`user:online:${userId}`);
      await prisma.user.update({ where: { id: userId }, data: { is_online: false, last_seen: new Date() } });
      socket.broadcast.emit('user_status', { userId, isOnline: false, lastSeen: new Date() });
    });
  });
};

export const getIo = () => {
  if (!io) {
    console.error('Socket.io is not initialized');
  }
  return io;
};
