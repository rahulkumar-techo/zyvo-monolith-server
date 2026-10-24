import type { Redis } from 'ioredis';
import type { User } from '@zyvo/database';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@zyvo/shared';
import type { AuthRepository } from '../repositories/index.js';
import type {
  OtpRequestInput,
  OtpVerifyInput,
  RegisterInput,
  LoginInput,
} from '../schemas/index.js';
import { hashPassword, verifyPassword } from '../../../common/utils/password.js';
import { OtpService, type SmsProvider } from './otp.service.js';
import { TokenService, type TokenServiceJwt } from './token.service.js';

export interface PublicUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
}

export interface AuthTokens {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RequestMetadata {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  public readonly otp: OtpService;
  public readonly tokens: TokenService;

  constructor(
    private readonly repo: AuthRepository,
    redis: Redis,
    jwt: TokenServiceJwt,
    jwtSecret: string,
    smsProvider?: SmsProvider
  ) {
    this.otp = new OtpService(redis, jwtSecret, smsProvider);
    this.tokens = new TokenService(jwt);
  }

  private sanitizeUser(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }

  // 1. Request OTP
  async requestOtp(input: OtpRequestInput): Promise<{ message: string; expiresIn: number }> {
    return this.otp.requestOtp(input.phone, input.purpose);
  }

  // 2. Verify OTP & Login/Create User
  async verifyOtp(input: OtpVerifyInput, metadata: RequestMetadata = {}): Promise<AuthTokens> {
    await this.otp.verifyOtp(input.phone, input.code);

    let user = await this.repo.findUserByPhone(input.phone);

    if (user) {
      if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
        throw new ForbiddenError(`Account is ${user.status.toLowerCase()}`);
      }
    } else {
      user = await this.repo.createUser({
        phone: input.phone,
        name: null,
        role: 'PASSENGER',
        status: 'ACTIVE',
      });
    }

    return this.createAuthTokens(user, metadata);
  }

  // 3. Register with email/password
  async register(input: RegisterInput, metadata: RequestMetadata = {}): Promise<AuthTokens> {
    if (input.email) {
      const existingEmail = await this.repo.findUserByEmail(input.email);
      if (existingEmail) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    if (input.phone) {
      const existingPhone = await this.repo.findUserByPhone(input.phone);
      if (existingPhone) {
        throw new ConflictError('A user with this phone number already exists');
      }
    }

    let passwordHash: string | null = null;
    if (input.password) {
      passwordHash = await hashPassword(input.password);
    }

    const user = await this.repo.createUser({
      name: input.name,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: 'PASSENGER',
      status: 'ACTIVE',
    });

    return this.createAuthTokens(user, metadata);
  }

  // 4. Login with email/password
  async login(input: LoginInput, metadata: RequestMetadata = {}): Promise<AuthTokens> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
      throw new ForbiddenError(`Account is ${user.status.toLowerCase()}`);
    }

    return this.createAuthTokens(user, metadata);
  }

  // 5. Token Refresh with rotation
  async refreshToken(
    refreshToken: string | undefined,
    _metadata: RequestMetadata = {}
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    const session = await this.repo.findSessionByToken(refreshToken);
    if (!session || session.isRevoked || session.expiresAt <= new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = session.user;
    if (user.status === 'SUSPENDED' || user.status === 'BLOCKED') {
      throw new ForbiddenError(`Account is ${user.status.toLowerCase()}`);
    }

    const newRefreshToken = this.tokens.generateRefreshToken();
    const newExpiresAt = this.tokens.calculateExpiryDate();

    await this.repo.updateSessionToken(session.id, newRefreshToken, newExpiresAt);

    const accessToken = this.tokens.signAccessToken(user.id, session.id, user.role);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }

  // 6. Logout current session
  async logout(sessionId?: string, refreshToken?: string): Promise<{ message: string }> {
    if (sessionId) {
      await this.repo.revokeSession(sessionId);
    } else if (refreshToken) {
      await this.repo.revokeSessionByToken(refreshToken);
    }
    return { message: 'Logged out successfully' };
  }

  // 7. Logout all sessions
  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.repo.revokeAllUserSessions(userId);
    return { message: 'All sessions logged out successfully' };
  }

  // 8. List active sessions
  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.repo.findActiveSessionsByUserId(userId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        isCurrent: s.id === currentSessionId,
      })),
    };
  }

  // 9. Revoke a specific session
  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundError('Session not found');
    }

    await this.repo.revokeSession(sessionId);
    return { message: 'Session revoked successfully' };
  }

  // 10. Get Current Identity
  async getMe(userId: string): Promise<{ user: PublicUser }> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError(`Account is ${user.status.toLowerCase()}`);
    }

    return {
      user: this.sanitizeUser(user),
    };
  }

  private async createAuthTokens(user: User, metadata: RequestMetadata): Promise<AuthTokens> {
    const refreshToken = this.tokens.generateRefreshToken();
    const expiresAt = this.tokens.calculateExpiryDate();

    const session = await this.repo.createSession({
      userId: user.id,
      refreshToken,
      deviceId: metadata.deviceId ?? null,
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null,
      expiresAt,
    });

    const accessToken = this.tokens.signAccessToken(user.id, session.id, user.role);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds,
    };
  }
}
