import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { Redis } from 'ioredis';

export interface RedisPluginOptions {
  client?: Redis;
  url?: string;
}

const redisPluginFn: FastifyPluginAsync<RedisPluginOptions> = async (fastify, options) => {
  const redisUrl = options.url ?? fastify.config.REDIS_URL;

  const client =
    options.client ??
    new Redis(redisUrl, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) {
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

  client.on('error', (err) => {
    fastify.log.error({ err }, 'Redis connection error');
  });

  // Connect if not already connected
  if (client.status === 'wait') {
    try {
      await client.connect();
    } catch (err) {
      fastify.log.warn({ err }, 'Redis failed to connect during plugin initialization');
    }
  }

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Disconnecting Redis client...');
    try {
      if (instance.redis.status === 'ready' || instance.redis.status === 'connecting') {
        await instance.redis.quit();
      } else {
        instance.redis.disconnect();
      }
    } catch (err) {
      instance.log.error({ err }, 'Error disconnecting Redis');
    }
  });
};

export const redisPlugin = fp(redisPluginFn, {
  name: 'redis',
});
