import { redis } from '../config/redis';
import { prisma } from '../config/db';
import { getIo } from '../sockets/socket'; // I will need to export io from socket.ts

const PRESENCE_TTL = 15 * 60; // 15 minutes

export const updateUserLocation = async (userId: string, roomId: string, method: 'WIFI' | 'BLE' | 'QR') => {
  const currentRoomKey = `presence:user:${userId}`;
  const previousRoomId = await redis.get(currentRoomKey);

  // If user is already in this room, just refresh TTL
  if (previousRoomId === roomId) {
    await redis.expire(currentRoomKey, PRESENCE_TTL);
    await redis.expire(`presence:room:${roomId}`, PRESENCE_TTL);
    return false; // Did not change rooms
  }

  // Remove from previous room if exists
  if (previousRoomId) {
    await redis.srem(`presence:room:${previousRoomId}`, userId);
    
    // Log exit in DB
    await prisma.movementLog.updateMany({
      where: { user_id: userId, room_id: previousRoomId, exited_at: null },
      data: { exited_at: new Date() }
    });
  }

  // Add to new room
  await redis.setex(currentRoomKey, PRESENCE_TTL, roomId);
  await redis.sadd(`presence:room:${roomId}`, userId);
  await redis.expire(`presence:room:${roomId}`, PRESENCE_TTL);

  // Update LivePresence table (upsert)
  await prisma.livePresence.upsert({
    where: { user_id: userId },
    update: { room_id: roomId, entered_at: new Date(), method },
    create: { user_id: userId, room_id: roomId, method }
  });

  // Create new movement log
  await prisma.movementLog.create({
    data: { user_id: userId, room_id: roomId, entered_at: new Date(), method }
  });

  return true; // Room changed
};

export const removeUserLocation = async (userId: string) => {
  const currentRoomKey = `presence:user:${userId}`;
  const previousRoomId = await redis.get(currentRoomKey);

  if (previousRoomId) {
    await redis.srem(`presence:room:${previousRoomId}`, userId);
    await redis.del(currentRoomKey);
    
    await prisma.movementLog.updateMany({
      where: { user_id: userId, room_id: previousRoomId, exited_at: null },
      data: { exited_at: new Date() }
    });
    
    await prisma.livePresence.deleteMany({
      where: { user_id: userId }
    });

    return previousRoomId;
  }
  return null;
};

export const getActiveUsersInRoom = async (roomId: string): Promise<string[]> => {
  return await redis.smembers(`presence:room:${roomId}`);
};

export const getUserCurrentRoom = async (userId: string): Promise<string | null> => {
  return await redis.get(`presence:user:${userId}`);
};
