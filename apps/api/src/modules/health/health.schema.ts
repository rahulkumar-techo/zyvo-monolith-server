import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
});

export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'unready']),
  services: z.object({
    database: z.enum(['up', 'down']),
    redis: z.enum(['up', 'down']),
  }),
  timestamp: z.string(),
});

export const apiMetadataResponseSchema = z.object({
  name: z.string(),
  version: z.string(),
  status: z.string(),
  environment: z.string(),
  docs: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
export type ApiMetadataResponse = z.infer<typeof apiMetadataResponseSchema>;
