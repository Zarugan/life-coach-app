import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let client: RedisClientType;

export async function connectRedis(): Promise<RedisClientType> {
  try {
    client = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (error) => {
      logger.error('Redis Client Error:', error);
    });

    client.on('connect', () => {
      logger.info('Redis Client Connected');
    });

    await client.connect();
    
    // Test connection
    await client.ping();
    
    logger.info('Redis connected successfully');
    return client;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

export function getRedis(): RedisClientType {
  if (!client || !client.isOpen) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client && client.isOpen) {
    await client.quit();
    logger.info('Redis connection closed');
  }
}