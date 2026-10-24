import type { PrismaClient } from '@zyvo/database';
import type { Redis } from 'ioredis';
import type { HealthResponse, ReadinessResponse } from './health.schema.js';

export class HealthService {
  getLiveness(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async checkReadiness(
    prisma: PrismaClient,
    redis: Redis
  ): Promise<{ isReady: boolean; response: ReadinessResponse }> {
    let databaseStatus: 'up' | 'down' = 'down';
    let redisStatus: 'up' | 'down' = 'down';

    // Verify database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'up';
    } catch {
      databaseStatus = 'down';
    }

    // Verify Redis connectivity
    try {
      const pingResult = await redis.ping();
      if (pingResult === 'PONG') {
        redisStatus = 'up';
      }
    } catch {
      redisStatus = 'down';
    }

    const isReady = databaseStatus === 'up' && redisStatus === 'up';

    return {
      isReady,
      response: {
        status: isReady ? 'ready' : 'unready',
        services: {
          database: databaseStatus,
          redis: redisStatus,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }
}

export const healthService = new HealthService();
