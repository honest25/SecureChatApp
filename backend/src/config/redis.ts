import { Redis } from 'ioredis';
import { env } from './env';

let redis: Redis;

try {
  redis = new Redis(env.REDIS_URL);
  
  redis.on('connect', () => {
    console.log('[Redis] Connected to Redis successfully');
  });

  redis.on('error', (err) => {
    console.error('[Redis] Connection Error:', err);
  });
} catch (error) {
  console.error('[Redis] Failed to initialize Redis', error);
  process.exit(1);
}

export { redis };
