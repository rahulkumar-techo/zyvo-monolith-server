import type { FastifyPluginAsync } from 'fastify';
import { healthService } from './health.service.js';
import { sendSuccess } from '../../common/utils/response.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', {
    schema: {
      description: 'Liveness probe to check if the API process is alive',
      tags: ['Health'],
    },
  }, async (_request, reply) => {
    const data = healthService.getLiveness();
    return sendSuccess(reply, data, 200);
  });

  fastify.get('/ready', {
    schema: {
      description: 'Readiness probe to check if database and redis dependencies are accessible',
      tags: ['Health'],
    },
  }, async (_request, reply) => {
    const { isReady, response } = await healthService.checkReadiness(fastify.prisma, fastify.redis);
    const statusCode = isReady ? 200 : 503;
    return sendSuccess(reply, response, statusCode);
  });
};

export const apiV1MetadataRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', {
    schema: {
      description: 'API v1 root metadata',
      tags: ['System'],
    },
  }, async (_request, reply) => {
    const metadata = {
      name: 'ZYVO API',
      version: '1.0.0',
      status: 'operational',
      environment: fastify.config.NODE_ENV,
      docs: '/docs',
    };
    return sendSuccess(reply, metadata, 200);
  });
};
