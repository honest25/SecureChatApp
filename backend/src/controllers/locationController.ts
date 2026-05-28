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
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, profile_pic_url: true } });
      
      // Emit socket event to the hostel feed
      const io = getIo();
      if (io && room && user) {
        io.to(`feed:${room.hostel_name}`).emit('user_moved', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          room: {
            id: room.id,
            room_number: room.room_number,
            floor: room.floor,
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

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return res.status(404).json({ success: false, message: 'Invalid QR code or room' });

    const roomChanged = await updateUserLocation(userId, roomId, 'QR');

    if (roomChanged) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, profile_pic_url: true } });
      const io = getIo();
      if (io && user) {
        io.to(`feed:${room.hostel_name}`).emit('user_moved', {
          userId: user.id,
          userName: user.name,
          profile_pic_url: user.profile_pic_url,
          room: { id: room.id, room_number: room.room_number, floor: room.floor, name: room.name },
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
