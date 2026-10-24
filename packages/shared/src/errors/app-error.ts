import { ErrorCodes, type ErrorCode, HttpStatusCodes, type HttpStatusCode } from '../constants/index.js';
import type { ApiErrorDetail } from '../types/api.js';

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCode | string;
  public readonly details?: ApiErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR,
    code: ErrorCode | string = ErrorCodes.INTERNAL_SERVER_ERROR,
    details?: ApiErrorDetail[],
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    if (typeof (Error as unknown as { captureStackTrace?: (target: object, constructor: unknown) => void }).captureStackTrace === 'function') {
      (Error as unknown as { captureStackTrace: (target: object, constructor: unknown) => void }).captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.BAD_REQUEST, ErrorCodes.BAD_REQUEST, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Request validation failed', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.FORBIDDEN, ErrorCodes.FORBIDDEN, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.CONFLICT, ErrorCodes.CONFLICT, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = 'Unprocessable entity', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.UNPROCESSABLE_ENTITY, ErrorCodes.UNPROCESSABLE_ENTITY, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_SERVER_ERROR, details, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', details?: ApiErrorDetail[]) {
    super(message, HttpStatusCodes.SERVICE_UNAVAILABLE, ErrorCodes.SERVICE_UNAVAILABLE, details, false);
  }
}
