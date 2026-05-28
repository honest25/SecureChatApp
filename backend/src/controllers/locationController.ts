import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { detectRoomFromSignals, LocationSignal } from '../services/locationEngine';
import { updateUserLocation, removeUserLocation, getActiveUsersInRoom, getUserCurrentRoom } from '../services/presenceService';
import { getIo } from '../sockets/socket';
import { z } from 'zod';

const updateLocationSchema = z.object({
  signals: z.array(z.object({
    mac: z.string(),
    rssi: z.number(),
    type: z.enum(['WIFI', 'BLE'])
  }))
});

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { signals } = updateLocationSchema.parse(req.body);
    const userId = req.user!.userId;

    const roomId = await detectRoomFromSignals(signals as LocationSignal[]);
    
    if (!roomId) {
      // Signals do not match any known rooms
      return res.json({ success: true, message: 'No known room detected', room: null });
    }

    const roomChanged = await updateUserLocation(userId, roomId, 'WIFI');
    
    if (roomChanged) {
      const room = await prisma.room.findUnique({ 
        where: { id: roomId },
        include: { building: true, floor: true }
      });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, profile_pic_url: true } });
      
      // Emit socket event to the hostel feed
      const io = getIo();
      if (io && room && user) {
        io.to(`feed:${room.building.name}`).emit('user_moved', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          room: {
            id: room.id,
            room_number: room.room_number,
            floor: room.floor.floor_level,
            name: room.name
          },
          action: 'ENTERED',
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, roomId });
  } catch (error) {
    next(error);
  }
};

export const manualCheckIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { qrCodeToken } = req.body;
    const userId = req.user!.userId;

    // A real implementation would verify the QR code token.
    // For now, assume it's just the room_id for testing purposes.
    const roomId = qrCodeToken; 

    const room = await prisma.room.findUnique({ 
      where: { id: roomId },
      include: { building: true, floor: true }
    });
    if (!room) return res.status(404).json({ success: false, message: 'Invalid QR code or room' });

    const roomChanged = await updateUserLocation(userId, roomId, 'QR');

    if (roomChanged) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, profile_pic_url: true } });
      const io = getIo();
      if (io && user) {
        io.to(`feed:${room.building.name}`).emit('user_moved', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          room: { id: room.id, room_number: room.room_number, floor: room.floor.floor_level, name: room.name },
          action: 'ENTERED_VIA_QR',
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

export const getCurrentLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const roomId = await getUserCurrentRoom(userId);

    if (!roomId) return res.json({ success: true, room: null });

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    res.json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

export const manualCheckOut = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const roomChanged = await removeUserLocation(userId);
    
    if (roomChanged) {
      const io = getIo();
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, hostel_name: true }});
      if (io && user && user.hostel_name) {
        io.to(`feed:${user.hostel_name}`).emit('user_moved', {
          userId: user.id,
          action: 'EXITED',
          timestamp: new Date()
        });
      }
    }
    res.json({ success: true, message: 'Checked out successfully' });
  } catch (error) {
    next(error);
  }
};

export const getNearbyUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hostel_name) return res.json({ success: true, nearby: [] });

    // Assuming we have the coordinates of the requester in LivePresence
    const presence = await prisma.livePresence.findUnique({ where: { user_id: userId } });
    if (!presence || !presence.latitude || !presence.longitude) {
      return res.json({ success: true, nearby: [] });
    }

    const { redis } = require('../config/redis');
    const geoKey = `hostel:locations:${user.hostel_name}`;
    const rawNearby = await redis.georadius(geoKey, presence.longitude, presence.latitude, 5000, 'm', 'WITHDIST');
    
    const nearby = rawNearby
      .filter((n: any) => n[0] !== userId)
      .map((n: any) => ({ userId: n[0], distanceMeters: Math.round(parseFloat(n[1])) }));

    res.json({ success: true, nearby });
  } catch (error) {
    next(error);
  }
};

export const getDistance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { targetUserId } = req.query;
    
    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ success: false, message: 'Missing targetUserId' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hostel_name) return res.status(400).json({ success: false, message: 'User hostel not set' });

    const { redis } = require('../config/redis');
    const geoKey = `hostel:locations:${user.hostel_name}`;
    const distanceStr = await redis.geodist(geoKey, userId, targetUserId, 'm');

    if (!distanceStr) return res.json({ success: true, distanceMeters: null });

    res.json({ success: true, distanceMeters: Math.round(parseFloat(distanceStr)) });
  } catch (error) {
    next(error);
  }
};

export const getRooms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hostel_name) return res.json({ success: true, rooms: [] });

    const building = await prisma.building.findUnique({ where: { name: user.hostel_name } });
    if (!building) return res.json({ success: true, rooms: [] });

    // Return all rooms and their polygons for the Floorplan Map
    const rooms = await prisma.room.findMany({
      where: { building_id: building.id },
      select: {
        id: true,
        room_number: true,
        name: true,
        polygon_coordinates: true,
        floor: { select: { floor_level: true, name: true } }
      }
    });

    res.json({ success: true, rooms });
  } catch (error) {
    next(error);
  }
};

export const getRoomOccupancy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const userIds = await getActiveUsersInRoom(roomId);
    
    if (userIds.length === 0) return res.json({ success: true, users: [] });

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, profile_pic_url: true }
    });

    res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
};

export const simulateMovement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { room_number } = req.body;
    const userId = req.user!.userId;

    if (!room_number) {
      return res.status(400).json({ success: false, message: 'Missing room_number' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.hostel_name) {
      return res.status(400).json({ success: false, message: 'User not found or hostel not set' });
    }

    const building = await prisma.building.findUnique({ where: { name: user.hostel_name }});
    if (!building) {
      return res.status(404).json({ success: false, message: 'Building not found' });
    }

    // Find the room
    const room = await prisma.room.findUnique({
      where: {
        building_id_room_number: {
          building_id: building.id,
          room_number: room_number,
        }
      },
      include: { floor: true }
    });

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found in your hostel' });
    }

    const roomChanged = await updateUserLocation(userId, room.id, 'WIFI');

    if (roomChanged) {
      const io = getIo();
      if (io) {
        io.to(`feed:${user.hostel_name}`).emit('user_moved', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          room: {
            id: room.id,
            room_number: room.room_number,
            floor: room.floor.floor_level,
            name: room.name
          },
          action: 'ENTERED',
          timestamp: new Date()
        });
      }
    }

    res.json({ success: true, message: `Successfully simulated entry into ${room_number}` });
  } catch (error) {
    next(error);
  }
};
