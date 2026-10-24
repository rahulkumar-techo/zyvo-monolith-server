import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../src/app.js';
import type { EnvConfig } from '../src/config/env.js';
import { NotFoundError, ConflictError, UnauthorizedError, ErrorCodes } from '@zyvo/shared';

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

describe('Centralized Error Handling & Validation', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const mockRedis = {
      status: 'ready',
      ping: vi.fn().mockResolvedValue('PONG'),
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
      disconnect: vi.fn(),
    };

    app = await buildApp({
      config: mockConfig,
      prisma: mockPrisma as any,
      redis: mockRedis as any,
    });

    // Add test routes to test validation and error handling
    app.post(
      '/test-validation',
      {
        schema: {
          body: z.object({
            email: z.string().email(),
            count: z.number().int().positive(),
          }),
        },
      },
      async (_req, reply) => {
        return reply.send({ success: true });
      }
    );

    app.get('/test-not-found-error', async () => {
      throw new NotFoundError('User profile not found');
    });

    app.get('/test-conflict-error', async () => {
      throw new ConflictError('Email already in use');
    });

    app.get('/test-unauthorized-error', async () => {
      throw new UnauthorizedError('Invalid access token');
    });

    app.get('/test-unexpected-error', async () => {
      throw new Error('Database disk corrupted');
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns standard 404 error when route does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.requestId).toBeDefined();
    expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(body.error.message).toContain('/non-existent-route');
  });

  it('returns standard validation error response when payload is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-validation',
      payload: {
        email: 'not-an-email',
        count: -5,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.requestId).toBeDefined();
    expect(body.error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(body.error.message).toBe('Request validation failed');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details.length).toBeGreaterThanOrEqual(1);
  });

  it('handles NotFoundError with 404 status and NOT_FOUND code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-not-found-error',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.NOT_FOUND);
    expect(body.error.message).toBe('User profile not found');
  });

  it('handles ConflictError with 409 status and CONFLICT code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-conflict-error',
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.CONFLICT);
    expect(body.error.message).toBe('Email already in use');
  });

  it('handles UnauthorizedError with 401 status and UNAUTHORIZED code', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-unauthorized-error',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ErrorCodes.UNAUTHORIZED);
    expect(body.error.message).toBe('Invalid access token');
  });

  it('handles unexpected internal errors with generic 500 response without leaking details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-unexpected-error',
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.requestId).toBeDefined();
    expect(body.error.code).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
    expect(body.error.message).toBe('An unexpected internal error occurred');
    expect(body.error.details).toBeUndefined();
    expect(res.body).not.toContain('Database disk corrupted');
  });
});
