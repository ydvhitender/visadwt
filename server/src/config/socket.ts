import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './env';
import { logger } from '../utils/logger';
import { User } from '../models/User';

let io: SocketServer;

// Track which socket IDs belong to which user
const socketUserMap = new Map<string, string>();

export function initSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('join', async (userId: string) => {
      socket.join(`user:${userId}`);
      socketUserMap.set(socket.id, userId);

      // Mark user online
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('agent_status', { userId, isOnline: true });
      } catch (err) {
        logger.warn('Failed to update online status:', err);
      }

      logger.info(`User ${userId} joined their room`);
    });

    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', async () => {
      const userId = socketUserMap.get(socket.id);
      socketUserMap.delete(socket.id);

      if (userId) {
        // Check if user has any other active sockets
        const userSockets = Array.from(socketUserMap.entries())
          .filter(([, uid]) => uid === userId);

        if (userSockets.length === 0) {
          try {
            await User.findByIdAndUpdate(userId, { isOnline: false });
            io.emit('agent_status', { userId, isOnline: false });
          } catch (err) {
            logger.warn('Failed to update offline status:', err);
          }
        }
      }

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
