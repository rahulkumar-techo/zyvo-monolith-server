import type { FastifyPluginAsync } from 'fastify';
import { AuthRepository } from './repositories/index.js';
import { AuthService } from './services/index.js';
import { AuthController } from './controllers/index.js';
import {
  otpRequestSchema,
  otpVerifySchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  sessionParamSchema,
  type OtpRequestInput,
  type OtpVerifyInput,
  type RegisterInput,
  type LoginInput,
  type RefreshTokenInput,
  type LogoutInput,
  type SessionParamInput,
} from './schemas/index.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new AuthRepository(fastify.prisma);
  const authService = new AuthService(
    repository,
    fastify.redis,
    fastify.jwt,
    fastify.config.JWT_ACCESS_SECRET
  );
  const controller = new AuthController(
    authService,
    fastify.jwt.verify.bind(fastify.jwt),
    fastify.config.NODE_ENV === 'production'
  );

  // 1. Request OTP
  fastify.post<{ Body: OtpRequestInput }>(
    '/otp/request',
    {
      schema: { body: otpRequestSchema },
    },
    (request, reply) => controller.requestOtp(request, reply)
  );

  // 2. Verify OTP, login/create user
  fastify.post<{ Body: OtpVerifyInput }>(
    '/otp/verify',
    {
      schema: { body: otpVerifySchema },
    },
    (request, reply) => controller.verifyOtp(request, reply)
  );

  // 3. Register with email/password
  fastify.post<{ Body: RegisterInput }>(
    '/register',
    {
      schema: { body: registerSchema },
    },
    (request, reply) => controller.register(request, reply)
  );

  // 4. Login with email/password
  fastify.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: { body: loginSchema },
    },
    (request, reply) => controller.login(request, reply)
  );

  // 5. Rotate refresh token
  fastify.post<{ Body: RefreshTokenInput }>(
    '/token/refresh',
    {
      schema: { body: refreshTokenSchema },
    },
    (request, reply) => controller.refreshToken(request, reply)
  );

  // 6. Revoke current refresh session
  fastify.post<{ Body: LogoutInput }>(
    '/logout',
    {
      schema: { body: logoutSchema },
    },
    (request, reply) => controller.logout(request, reply)
  );

  // 7. Revoke all refresh sessions
  fastify.post(
    '/logout-all',
    {
      preHandler: [fastify.authenticate],
    },
    (request, reply) => controller.logoutAll(request, reply)
  );

  // 8. Current authenticated identity
  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
    },
    (request, reply) => controller.getMe(request, reply)
  );

  // 9. List active sessions
  fastify.get(
    '/sessions',
    {
      preHandler: [fastify.authenticate],
    },
    (request, reply) => controller.listSessions(request, reply)
  );

  // 10. Revoke a specific session
  fastify.delete<{ Params: SessionParamInput }>(
    '/sessions/:sessionId',
    {
      schema: { params: sessionParamSchema },
      preHandler: [fastify.authenticate],
    },
    (request, reply) => controller.revokeSession(request, reply)
  );
};
