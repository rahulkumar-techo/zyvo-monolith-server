import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthService, RequestMetadata } from '../services/index.js';
import type {
  OtpRequestInput,
  OtpVerifyInput,
  RegisterInput,
  LoginInput,
  RefreshTokenInput,
  LogoutInput,
  SessionParamInput,
} from '../schemas/index.js';
import { sendSuccess } from '../../../common/utils/response.js';

export class AuthController {
  private readonly cookieOptions: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    maxAge: number;
  };

  constructor(
    private readonly service: AuthService,
    private readonly jwtVerify: <T extends object>(token: string) => Promise<T>,
    isProduction: boolean
  ) {
    this.cookieOptions = {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    };
  }

  private extractMetadata(request: FastifyRequest, deviceId?: string): RequestMetadata {
    return {
      deviceId,
      userAgent: (request.headers['user-agent'] as string) || undefined,
      ipAddress: request.ip,
    };
  }

  // POST /otp/request
  async requestOtp(request: FastifyRequest<{ Body: OtpRequestInput }>, reply: FastifyReply) {
    const result = await this.service.requestOtp(request.body);
    return sendSuccess(reply, result, 200);
  }

  // POST /otp/verify
  async verifyOtp(request: FastifyRequest<{ Body: OtpVerifyInput }>, reply: FastifyReply) {
    const metadata = this.extractMetadata(request, request.body.deviceId);
    const result = await this.service.verifyOtp(request.body, metadata);

    reply.setCookie('refreshToken', result.refreshToken, this.cookieOptions);
    return sendSuccess(reply, result, 200);
  }

  // POST /register
  async register(request: FastifyRequest<{ Body: RegisterInput }>, reply: FastifyReply) {
    const metadata = this.extractMetadata(request);
    const result = await this.service.register(request.body, metadata);

    reply.setCookie('refreshToken', result.refreshToken, this.cookieOptions);
    return sendSuccess(reply, result, 201);
  }

  // POST /login
  async login(request: FastifyRequest<{ Body: LoginInput }>, reply: FastifyReply) {
    const metadata = this.extractMetadata(request);
    const result = await this.service.login(request.body, metadata);

    reply.setCookie('refreshToken', result.refreshToken, this.cookieOptions);
    return sendSuccess(reply, result, 200);
  }

  // POST /token/refresh
  async refreshToken(request: FastifyRequest<{ Body: RefreshTokenInput }>, reply: FastifyReply) {
    const refreshToken = request.body?.refreshToken || request.cookies?.refreshToken;
    const metadata = this.extractMetadata(request);
    const result = await this.service.refreshToken(refreshToken, metadata);

    reply.setCookie('refreshToken', result.refreshToken, this.cookieOptions);
    return sendSuccess(reply, result, 200);
  }

  // POST /logout
  async logout(request: FastifyRequest<{ Body: LogoutInput }>, reply: FastifyReply) {
    let sessionId: string | undefined;
    const refreshToken = request.body?.refreshToken || request.cookies?.refreshToken;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7).trim();
        const decoded = await this.jwtVerify<{ sessionId?: string }>(token);
        sessionId = decoded.sessionId;
      } catch {
        // Fall back to refreshToken if present
      }
    }

    const result = await this.service.logout(sessionId, refreshToken);
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return sendSuccess(reply, result, 200);
  }

  // POST /logout-all
  async logoutAll(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.logoutAll(request.authUser.id);
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
    return sendSuccess(reply, result, 200);
  }

  // GET /me
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.getMe(request.authUser.id);
    return sendSuccess(reply, result, 200);
  }

  // GET /sessions
  async listSessions(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.listSessions(request.authUser.id, request.authSessionId);
    return sendSuccess(reply, result, 200);
  }

  // DELETE /sessions/:sessionId
  async revokeSession(request: FastifyRequest<{ Params: SessionParamInput }>, reply: FastifyReply) {
    const result = await this.service.revokeSession(
      request.authUser.id,
      request.params.sessionId
    );
    return sendSuccess(reply, result, 200);
  }
}
