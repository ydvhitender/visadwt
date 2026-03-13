import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/messages', analyticsController.messageStats);
router.get('/conversations', analyticsController.conversationStats);
router.get('/response-times', analyticsController.responseTimeStats);
router.get('/agents', analyticsController.agentPerformance);

export default router;
