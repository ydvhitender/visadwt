import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './env';
import { logger } from '../utils/logger';

let io: SocketServer;

export function initSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join', (userId: string) => {
      socket.join(`user:${userId}`);
      logger.info(`User ${userId} joined their room`);
    });

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}
