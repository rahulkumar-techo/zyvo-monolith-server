import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@zyvo/database';
import { AppError, ErrorCodes, type ApiErrorDetail } from '@zyvo/shared';
import { sendError } from '../utils/response.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): FastifyReply {
  // 1. Zod validation errors
  if (error instanceof ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return sendError(
      reply,
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Request validation failed',
      details
    );
  }

  // 2. Fastify schema validation errors
  if ('validation' in error && Array.isArray(error.validation)) {
    const details: ApiErrorDetail[] = error.validation.map((item) => ({
      path: item.instancePath || (item.params as Record<string, unknown>)?.missingProperty as string || '',
      message: item.message ?? 'Invalid input',
      code: item.keyword,
    }));

    return sendError(
      reply,
      400,
      ErrorCodes.VALIDATION_ERROR,
      'Request validation failed',
      details
    );
  }

  // 3. Known application errors
  if (error instanceof AppError) {
    return sendError(
      reply,
      error.statusCode,
      error.code,
      error.message,
      error.details
    );
  }

  // 4. Rate limit errors
  if ('statusCode' in error && error.statusCode === 429) {
    return sendError(
      reply,
      429,
      ErrorCodes.RATE_LIMIT_EXCEEDED,
      'Too many requests, please try again later'
    );
  }

  // 5. Authentication and JWT errors
  if (
    ('statusCode' in error && error.statusCode === 401) ||
    error.name === 'FastifyJWTError' ||
    error.name === 'UnauthorizedError'
  ) {
    return sendError(
      reply,
      401,
      ErrorCodes.UNAUTHORIZED,
      error.message || 'Authentication required'
    );
  }

  // 6. Prisma database errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const targets = Array.isArray(error.meta?.target) ? (error.meta.target as string[]).join(', ') : 'field';
      return sendError(
        reply,
        409,
        ErrorCodes.CONFLICT,
        `Resource already exists with this ${targets}`
      );
    }

    if (error.code === 'P2025') {
      return sendError(
        reply,
        404,
        ErrorCodes.NOT_FOUND,
        'Resource not found'
      );
    }

    if (error.code === 'P2003') {
      return sendError(
        reply,
        409,
        ErrorCodes.CONFLICT,
        'Related resource constraint failed'
      );
    }
  }

  // 7. Route not found
  if ('statusCode' in error && error.statusCode === 404) {
    return sendError(
      reply,
      404,
      ErrorCodes.NOT_FOUND,
      `Route ${request.method} ${request.url} not found`
    );
  }

  // 8. Unexpected internal errors
  request.log.error(
    {
      err: error,
      requestId: request.id,
      url: request.url,
      method: request.method,
    },
    'Unhandled server error'
  );

  return sendError(
    reply,
    500,
    ErrorCodes.INTERNAL_SERVER_ERROR,
    'An unexpected internal error occurred'
  );
}
