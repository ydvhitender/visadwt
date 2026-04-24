import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorMiddleware } from './middleware/error.middleware';

// Routes
import webhookRoutes from './routes/webhook.routes';
import authRoutes from './routes/auth.routes';
import messageRoutes from './routes/message.routes';
import conversationRoutes from './routes/conversation.routes';
import contactRoutes from './routes/contact.routes';
import templateRoutes from './routes/template.routes';
import mediaRoutes from './routes/media.routes';
import userRoutes from './routes/user.routes';
import cannedResponseRoutes from './routes/cannedResponse.routes';
import tagRoutes from './routes/tag.routes';
import analyticsRoutes from './routes/analytics.routes';
import sqlRoutes from './routes/sql.routes';
import flowRoutes from './routes/flow.routes';
import backupRoutes from './routes/backup.routes';

const app = express();

// Middleware
const allowedOrigins = env.CLIENT_URL.split(',').map((s) => s.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/canned-responses', cannedResponseRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sql', sqlRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorMiddleware);

export default app;
