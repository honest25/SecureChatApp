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
      origin: env.FRONTEND_URL,
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
          // Use Indoor Location Engine to check if user entered a room's polygon boundary
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

        // Log movement if room changed (we should ideally track previous room in Redis, simplified here)
        if (roomId) {
            await redis.setex(`presence:user:${userId}:room`, 15 * 60, roomId);
        } else {
            await redis.del(`presence:user:${userId}:room`);
        }

        // Broadcast raw GPS + Room info to others in the same hostel feed
        io.to(`feed:${data.hostelName}`).emit('user_gps_updated', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          latitude: data.lat,
          longitude: data.lon,
          roomId: roomId,
          roomName: roomName,
          roomNumber: roomNumber,
          timestamp: new Date()
        });
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
