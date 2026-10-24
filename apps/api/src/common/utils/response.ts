import type { FastifyReply } from 'fastify';
import type { ApiSuccessResponse, ApiErrorResponse, ApiErrorDetail } from '@zyvo/shared';

export function sendSuccess<T>(
  reply: FastifyReply,
  data: T,
  statusCode = 200
): FastifyReply {
  const requestId = reply.request.id;
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
    requestId,
  };
  return reply.status(statusCode).send(payload);
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[]
): FastifyReply {
  const requestId = reply.request.id;
  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
    requestId,
  };
  return reply.status(statusCode).send(payload);
}
