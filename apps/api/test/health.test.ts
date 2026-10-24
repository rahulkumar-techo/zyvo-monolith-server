import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { EnvConfig } from '../src/config/env.js';

const mockConfig: EnvConfig = {
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

describe('Health and Readiness Routes', () => {
  let app: FastifyInstance;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    mockRedis = {
      status: 'ready',
      ping: vi.fn().mockResolvedValue('PONG'),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    app = await buildApp({
      config: mockConfig,
      prisma: mockPrisma,
      redis: mockRedis,
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 and liveness status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.data.status).toBe('ok');
    expect(body.data.timestamp).toBeDefined();
    expect(typeof body.data.uptime).toBe('number');
  });

  it('GET /api/v1 returns 200 and API metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.requestId).toBeDefined();
    expect(body.data.name).toBe('ZYVO API');
    expect(body.data.version).toBe('1.0.0');
    expect(body.data.docs).toBe('/docs');
  });

  it('GET /ready returns 200 when all dependencies are healthy', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ready');
    expect(body.data.services.database).toBe('up');
    expect(body.data.services.redis).toBe('up');
  });

  it('GET /ready returns 503 when database is unavailable', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB Connection Refused'));

    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('unready');
    expect(body.data.services.database).toBe('down');
    expect(body.data.services.redis).toBe('up');
  });

  it('GET /ready returns 503 when redis is unavailable', async () => {
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis timeout'));

    const res = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(res.statusCode).toBe(503);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('unready');
    expect(body.data.services.database).toBe('up');
    expect(body.data.services.redis).toBe('down');
  });
});
