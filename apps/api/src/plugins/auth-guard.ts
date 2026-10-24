import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { UnauthorizedError, ForbiddenError, AppError } from '@zyvo/shared';

const authGuardPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async function (request: FastifyRequest, _reply: FastifyReply) {
    let token: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    if (!token) {
      throw new UnauthorizedError('Authentication token required');
    }

    try {
      const payload = await fastify.jwt.verify<{ sub: string; sessionId?: string; role?: string }>(token);

      const user = await fastify.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedError('User account not found');
      }

      if (user.status !== 'ACTIVE') {
        throw new ForbiddenError(`Account is ${user.status.toLowerCase()}`);
      }

      if (payload.sessionId) {
        const session = await fastify.prisma.session.findUnique({
          where: { id: payload.sessionId },
        });

        if (!session || session.isRevoked || session.expiresAt <= new Date()) {
          throw new UnauthorizedError('Session has expired or been revoked');
        }
      }

      request.authUser = user;
      request.authSessionId = payload.sessionId;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });
};

export default fp(authGuardPlugin);
