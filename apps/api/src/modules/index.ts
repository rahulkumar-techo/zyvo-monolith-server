import type { FastifyPluginAsync } from 'fastify';
import { apiV1MetadataRoute } from './health/health.routes.js';
import { authRoutes } from './auth/routes.js';
import { usersRoutes } from './users/routes.js';
import { ridersRoutes } from './riders/routes.js';
import { vehiclesRoutes } from './vehicles/routes.js';
import { ridesRoutes } from './rides/routes.js';
import { dispatchRoutes } from './dispatch/routes.js';
import { pricingRoutes } from './pricing/routes.js';
import { paymentsRoutes } from './payments/routes.js';
import { walletsRoutes } from './wallets/routes.js';
import { notificationsRoutes } from './notifications/routes.js';
import { ratingsRoutes } from './ratings/routes.js';
import { adminRoutes } from './admin/routes.js';

export const apiV1Routes: FastifyPluginAsync = async (fastify) => {
  // Root metadata for /api/v1
  await fastify.register(apiV1MetadataRoute);

  // Business module routes
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(usersRoutes, { prefix: '/users' });
  await fastify.register(ridersRoutes, { prefix: '/riders' });
  await fastify.register(vehiclesRoutes, { prefix: '/vehicles' });
  await fastify.register(ridesRoutes, { prefix: '/rides' });
  await fastify.register(dispatchRoutes, { prefix: '/dispatch' });
  await fastify.register(pricingRoutes, { prefix: '/pricing' });
  await fastify.register(paymentsRoutes, { prefix: '/payments' });
  await fastify.register(walletsRoutes, { prefix: '/wallets' });
  await fastify.register(notificationsRoutes, { prefix: '/notifications' });
  await fastify.register(ratingsRoutes, { prefix: '/ratings' });
  await fastify.register(adminRoutes, { prefix: '/admin' });
};
