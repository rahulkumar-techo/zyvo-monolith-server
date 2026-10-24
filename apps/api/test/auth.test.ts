import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { EnvConfig } from '../src/config/env.js';
import { hashPassword } from '../src/common/utils/password.js';

const testConfig: EnvConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3001,
  DATABASE_URL: 'postgresql://mock:mock@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'super_secret_jwt_key_at_least_32_characters_long_for_test',
  JWT_ACCESS_TTL: '15m',
  CORS_ORIGIN: '*',
  LOG_LEVEL: 'fatal',
};

// In-memory mock database and redis for hermetic unit and integration tests
function createMockPrisma() {
  const users: any[] = [];
  const sessions: any[] = [];

  return {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string; phone?: string } }) => {
        if (where.id) return users.find((u) => u.id === where.id) || null;
        if (where.email) return users.find((u) => u.email === where.email) || null;
        if (where.phone) return users.find((u) => u.phone === where.phone) || null;
        return null;
      }),
      create: vi.fn(async ({ data }: { data: any }) => {
        const newUser = {
          id: crypto.randomUUID(),
          phone: data.phone || null,
          email: data.email || null,
          name: data.name || null,
          passwordHash: data.passwordHash || null,
          role: data.role || 'PASSENGER',
          status: data.status || 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(newUser);
        return newUser;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const user = users.find((u) => u.id === where.id);
        if (user) Object.assign(user, data, { updatedAt: new Date() });
        return user;
      }),
    },
    session: {
      create: vi.fn(async ({ data }: { data: any }) => {
        const newSession = {
          id: crypto.randomUUID(),
          userId: data.userId,
          refreshToken: data.refreshToken,
          deviceId: data.deviceId || null,
          userAgent: data.userAgent || null,
          ipAddress: data.ipAddress || null,
          isRevoked: false,
          expiresAt: data.expiresAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sessions.push(newSession);
        return newSession;
      }),
      findUnique: vi.fn(async ({ where, include }: { where: { id?: string; refreshToken?: string }; include?: any }) => {
        const s = sessions.find((item) => (where.id ? item.id === where.id : item.refreshToken === where.refreshToken));
        if (!s) return null;
        if (include?.user) {
          const u = users.find((user) => user.id === s.userId);
          return { ...s, user: u };
        }
        return s;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const s = sessions.find((item) => item.id === where.id);
        if (s) Object.assign(s, data, { updatedAt: new Date() });
        return s;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { userId?: string; refreshToken?: string; isRevoked?: boolean }; data: any }) => {
        let count = 0;
        for (const s of sessions) {
          if (where.userId && s.userId !== where.userId) continue;
          if (where.refreshToken && s.refreshToken !== where.refreshToken) continue;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) continue;
          Object.assign(s, data, { updatedAt: new Date() });
          count++;
        }
        return { count };
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string; isRevoked?: boolean; expiresAt?: any } }) => {
        return sessions.filter((s) => {
          if (s.userId !== where.userId) return false;
          if (where.isRevoked !== undefined && s.isRevoked !== where.isRevoked) return false;
          if (where.expiresAt?.gt && s.expiresAt <= where.expiresAt.gt) return false;
          return true;
        });
      }),
    },
    _store: { users, sessions },
  };
}

function createMockRedis() {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    status: 'ready',
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
    disconnect: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, mode?: string, ttl?: number) => {
      const expiresAt = mode === 'EX' && ttl ? Date.now() + ttl * 1000 : undefined;
      store.set(key, { value, expiresAt });
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    ttl: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry || !entry.expiresAt) return -1;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),
    _store: store,
  };
}

describe('Authentication Module Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(async () => {
    mockPrisma = createMockPrisma();
    mockRedis = createMockRedis();

    app = await buildApp({
      config: testConfig,
      prisma: mockPrisma as any,
      redis: mockRedis as any,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/otp/request', () => {
    it('successfully requests OTP for a valid E.164 phone number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: {
          phone: '+919876543210',
          purpose: 'LOGIN',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('OTP sent successfully');
      expect(body.data.expiresIn).toBe(300);
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('rejects invalid phone number formats with 400 validation error', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: {
          phone: '9876543210', // Missing +
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('enforces resend cooldown with 429 status', async () => {
      // First request
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phone: '+919876543210' },
      });

      // Immediate second request within cooldown
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phone: '+919876543210' },
      });

      expect(res.statusCode).toBe(429);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('POST /api/v1/auth/otp/verify', () => {
    it('returns 422 if OTP was not requested or expired', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: {
          phone: '+919876543210',
          code: '123456',
        },
      });

      expect(res.statusCode).toBe(422);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.message).toContain('Invalid or expired OTP');
    });

    it('verifies valid OTP, creates new PASSENGER account, and returns tokens', async () => {
      const phone = '+919876543210';

      // 1. Request OTP
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phone },
      });

      // Retrieve generated OTP from test Redis key
      const generatedCode = await mockRedis.get(`otp:test:${phone}`);
      expect(generatedCode).toBeDefined();

      // 2. Verify OTP
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: {
          phone,
          code: generatedCode!,
          deviceId: 'device-mobile-1',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.phone).toBe(phone);
      expect(body.data.user.role).toBe('PASSENGER');
      expect(body.data.user.status).toBe('ACTIVE');
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.expiresIn).toBe(900);

      // Verify cookies set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(String(cookies)).toContain('refreshToken=');
    });

    it('increments attempts on wrong code and locks out after max attempts with 429', async () => {
      const phone = '+919876543210';

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phone },
      });

      // Attempt 1 with wrong code -> 422
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: { phone, code: '000000' },
      });
      expect(res1.statusCode).toBe(422);

      // Attempt 2 with wrong code -> 422
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: { phone, code: '000000' },
      });
      expect(res2.statusCode).toBe(422);

      // Attempt 3 with wrong code -> 422
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: { phone, code: '000000' },
      });
      expect(res3.statusCode).toBe(422);

      // Attempt 4 -> 429 Too many failed attempts
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: { phone, code: '000000' },
      });
      expect(res4.statusCode).toBe(429);
      const body4 = JSON.parse(res4.body);
      expect(body4.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('returns 403 when user account is SUSPENDED', async () => {
      const phone = '+919876543210';

      // Pre-seed suspended user
      await mockPrisma.user.create({
        data: {
          phone,
          role: 'PASSENGER',
          status: 'SUSPENDED',
        },
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/request',
        payload: { phone },
      });

      const code = await mockRedis.get(`otp:test:${phone}`);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/otp/verify',
        payload: { phone, code: code! },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/v1/auth/register & POST /login (Email/Password)', () => {
    it('registers user with 201 Created and enforces PASSENGER role', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+919876543299',
          password: 'securePassword123',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.name).toBe('Jane Doe');
      expect(body.data.user.email).toBe('jane@example.com');
      expect(body.data.user.role).toBe('PASSENGER');
      expect(body.data.accessToken).toBeDefined();
    });

    it('rejects registration with duplicate email with 409 Conflict', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Jane Doe',
          email: 'duplicate@example.com',
          password: 'securePassword123',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Jane Two',
          email: 'duplicate@example.com',
          password: 'anotherPassword123',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('logs in successfully with valid email and password', async () => {
      const passwordHash = await hashPassword('correctPassword123');
      await mockPrisma.user.create({
        data: {
          name: 'Existing User',
          email: 'login@example.com',
          passwordHash,
          role: 'PASSENGER',
          status: 'ACTIVE',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'correctPassword123',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe('login@example.com');
      expect(body.data.accessToken).toBeDefined();
    });

    it('rejects login with invalid password with 401 Unauthorized', async () => {
      const passwordHash = await hashPassword('correctPassword123');
      await mockPrisma.user.create({
        data: {
          email: 'login@example.com',
          passwordHash,
          role: 'PASSENGER',
          status: 'ACTIVE',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'login@example.com',
          password: 'wrongPassword',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Token Refresh, Sessions, and Current Identity', () => {
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          name: 'Session User',
          email: 'session@example.com',
          password: 'password1234',
        },
      });
      const data = JSON.parse(regRes.body).data;
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      userId = data.user.id;
    });

    it('POST /token/refresh rotates the refresh token and issues new tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/token/refresh',
        payload: { refreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.refreshToken).not.toBe(refreshToken); // Rotated token
    });

    it('POST /token/refresh rejects expired or revoked refresh token with 401', async () => {
      // First refresh: consumes old token
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/token/refresh',
        payload: { refreshToken },
      });

      // Second attempt with old token -> 401
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/token/refresh',
        payload: { refreshToken },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/v1/auth/me returns current authenticated user identity', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.id).toBe(userId);
      expect(body.data.user.email).toBe('session@example.com');
    });

    it('GET /api/v1/auth/me rejects missing or invalid access token with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/v1/auth/sessions lists active sessions', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.sessions)).toBe(true);
      expect(body.data.sessions.length).toBeGreaterThan(0);
      expect(body.data.sessions[0].isCurrent).toBe(true);
    });

    it('DELETE /api/v1/auth/sessions/:sessionId revokes session', async () => {
      const sessionsRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });
      const sessionId = JSON.parse(sessionsRes.body).data.sessions[0].id;

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/sessions/${sessionId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(delRes.statusCode).toBe(200);
      const body = JSON.parse(delRes.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Session revoked successfully');
    });

    it('POST /api/v1/auth/logout revokes current session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('Logged out successfully');
    });

    it('POST /api/v1/auth/logout-all revokes all sessions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.message).toBe('All sessions logged out successfully');
    });
  });
});
