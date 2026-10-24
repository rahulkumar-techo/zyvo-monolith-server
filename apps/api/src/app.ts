import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { PrismaClient } from '@zyvo/database';
import type { Redis } from 'ioredis';
import { loadConfig, type EnvConfig } from './config/env.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { securityPlugin } from './plugins/security.js';
import authGuardPlugin from './plugins/auth-guard.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { errorHandler } from './common/errors/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { apiV1Routes } from './modules/index.js';
import { sendError } from './common/utils/response.js';
import { ErrorCodes } from '@zyvo/shared';
import './types/index.js';

export interface AppOptions {
  config?: EnvConfig;
  prisma?: PrismaClient;
  redis?: Redis;
  serverOptions?: FastifyServerOptions;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();

  const app = fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    ...options.serverOptions,
  }).withTypeProvider<ZodTypeProvider>();

  // Attach configuration to Fastify instance
  app.decorate('config', config);

  // Configure Zod validation and serialization
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Centralized error handler
  app.setErrorHandler(errorHandler);

  // Custom 404 handler conforming to API contract
  app.setNotFoundHandler((request, reply) => {
    return sendError(
      reply,
      404,
      ErrorCodes.NOT_FOUND,
      `Route ${request.method} ${request.url} not found`
    );
  });

  // Register core infrastructure plugins
  await app.register(prismaPlugin, { client: options.prisma });
  await app.register(redisPlugin, { client: options.redis });
  await app.register(securityPlugin);
  await app.register(authGuardPlugin);
  await app.register(swaggerPlugin);

  // Register root health probes
  await app.register(healthRoutes);

  // Register API v1 routes
  await app.register(apiV1Routes, { prefix: '/api/v1' });

  return app;
}
