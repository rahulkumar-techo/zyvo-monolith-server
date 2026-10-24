import { loadConfig } from './config/env.js';
import { buildApp } from './app.js';

async function startServer(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received termination signal, starting graceful shutdown...');
    try {
      await app.close();
      app.log.info('Server and all connections closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during server shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : config.HOST;
    const port = Number(process.env.PORT) || config.PORT || 10000;
    await app.listen({ host, port });
    app.log.info(`ZYVO API server listening on http://${host}:${port}`);
    app.log.info(`Swagger documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

void startServer();
