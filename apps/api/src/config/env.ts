import dotenv from 'dotenv';

// Only load .env file in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export interface EnvConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL: string;
  CORS_ORIGIN: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

let cachedConfig: EnvConfig | null = null;

export function loadConfig(overrides?: Partial<EnvConfig>): EnvConfig {
  if (cachedConfig && !overrides) {
    return cachedConfig;
  }

  const nodeEnv = (overrides?.NODE_ENV || process.env.NODE_ENV || 'development') as EnvConfig['NODE_ENV'];
  const isProd = nodeEnv === 'production';

  // In production, always bind to 0.0.0.0 so Render and cloud load balancers can route traffic
  let host = overrides?.HOST || process.env.HOST || '0.0.0.0';
  if (isProd && (host === '127.0.0.1' || host === 'localhost')) {
    host = '0.0.0.0';
  }

  // Render automatically assigns PORT (typically 10000)
  const rawPort = overrides?.PORT ?? process.env.PORT;
  const parsedPort = rawPort !== undefined ? Number(rawPort) : (isProd ? 10000 : 3000);
  const port = Number.isNaN(parsedPort) || parsedPort <= 0 ? 10000 : parsedPort;

  const databaseUrl = overrides?.DATABASE_URL || process.env.DATABASE_URL || '';
  const redisUrl = overrides?.REDIS_URL || process.env.REDIS_URL || '';
  const jwtAccessSecret =
    overrides?.JWT_ACCESS_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    'zyvo_super_secret_jwt_access_token_key_change_in_production';
  const jwtAccessTtl = overrides?.JWT_ACCESS_TTL || process.env.JWT_ACCESS_TTL || '15m';
  const corsOrigin = overrides?.CORS_ORIGIN || process.env.CORS_ORIGIN || '*';
  const logLevel = (overrides?.LOG_LEVEL || process.env.LOG_LEVEL || 'info') as EnvConfig['LOG_LEVEL'];

  const config: EnvConfig = {
    NODE_ENV: nodeEnv,
    HOST: host,
    PORT: port,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_ACCESS_TTL: jwtAccessTtl,
    CORS_ORIGIN: corsOrigin,
    LOG_LEVEL: logLevel,
  };

  if (!overrides) {
    cachedConfig = config;
  }

  return config;
}

export function resetConfigForTest(): void {
  cachedConfig = null;
}
