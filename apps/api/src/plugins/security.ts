import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

const securityPluginFn: FastifyPluginAsync = async (fastify) => {
  // Helmet for secure HTTP headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: fastify.config.CORS_ORIGIN === '*' ? true : fastify.config.CORS_ORIGIN.split(','),
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Cookie parser
  await fastify.register(cookie);

  // JWT authentication
  await fastify.register(jwt, {
    secret: fastify.config.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: fastify.config.JWT_ACCESS_TTL,
    },
  });
};

export const securityPlugin = fp(securityPluginFn, {
  name: 'security',
});
