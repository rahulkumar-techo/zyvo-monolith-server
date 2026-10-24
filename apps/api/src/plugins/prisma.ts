import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { prisma as defaultPrisma, type PrismaClient } from '@zyvo/database';

export interface PrismaPluginOptions {
  client?: PrismaClient;
}

const prismaPluginFn: FastifyPluginAsync<PrismaPluginOptions> = async (fastify, options) => {
  const client = options.client ?? defaultPrisma;

  fastify.decorate('prisma', client);

  fastify.addHook('onClose', async (instance) => {
    instance.log.info('Disconnecting Prisma client...');
    await instance.prisma.$disconnect();
  });
};

export const prismaPlugin = fp(prismaPluginFn, {
  name: 'prisma',
});
