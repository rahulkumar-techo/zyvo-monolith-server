import type { PrismaClient, User } from '@zyvo/database';
import type { Redis } from 'ioredis';
import type { EnvConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
    config: EnvConfig;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authUser: User;
    authSessionId?: string;
  }
}

export type { EnvConfig };
