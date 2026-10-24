import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import dotenv from 'dotenv';

function findWorkspaceRoot(startDir: string): string {
  let cur = startDir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(cur, '.env'))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return process.cwd();
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = findWorkspaceRoot(currentDir);

dotenv.config();
dotenv.config({ path: path.join(workspaceRoot, '.env') });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(Number(process.env.PORT) || 10000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .default('zyvo_super_secret_jwt_access_token_key_change_in_production'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function loadConfig(overrides?: Partial<Record<string, unknown>>): EnvConfig {
  if (overrides) {
    const parsed = envSchema.safeParse({ ...process.env, ...overrides });
    if (!parsed.success) {
      const errorIssues = parsed.error.issues
        .map((issue) => ` - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${errorIssues}`);
    }
    return parsed.data;
  }

  if (cachedConfig) {
    return cachedConfig;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const errorIssues = parsed.error.issues
      .map((issue) => ` - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errorIssues}`);
  }

  cachedConfig = parsed.data;
  return cachedConfig;
}

export function resetConfigForTest(): void {
  cachedConfig = null;
}
