import { prisma } from '../config/db';
import { redis } from '../config/redis';

/**
 * Periodically cleans up stale user locations from the database and Redis.
 * Runs every 5 minutes. If a LivePresence is older than 15 minutes, it is pruned.
 */
export const startPresenceCleanupWorker = () => {
  console.log('[Worker] Starting Presence Cleanup Worker...');
  
  setInterval(async () => {
    try {
      const staleThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      
      // 1. Find all stale presences
      const stalePresences = await prisma.livePresence.findMany({
        where: { updated_at: { lt: staleThreshold } },
        include: { user: { select: { hostel_name: true } } }
      });

      if (stalePresences.length > 0) {
        const userIds = stalePresences.map(p => p.user_id);
        
        // 2. Remove from DB
        await prisma.livePresence.deleteMany({
          where: { user_id: { in: userIds } }
        });
        
        // 3. Remove from Redis GEO & Presence Room cache
        for (const presence of stalePresences) {
          await redis.del(`presence:user:${presence.user_id}:room`);
          if (presence.user?.hostel_name) {
            const geoKey = `hostel:locations:${presence.user.hostel_name}`;
            await redis.zrem(geoKey, presence.user_id); // GEO uses sorted sets (zset) internally
          }
        }
        
        console.log(`[Worker] Cleaned up ${stalePresences.length} stale presences.`);
      }
    } catch (err) {
      console.error('[Worker] Error during presence cleanup:', err);
    }
  }, 5 * 60 * 1000); // Run every 5 mins
};
