import http from 'http';
import app from './app';
import { env } from './config/env';
import { connectDB } from './config/db';
import { initSocketIO } from './config/socket';
import { testMysqlConnection } from './config/mysql';
import { logger } from './utils/logger';

async function start() {
  await connectDB();
  await testMysqlConnection();

  const server = http.createServer(app);
  initSocketIO(server);

  server.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT}`);
    logger.info(`Developed by elnitish`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
