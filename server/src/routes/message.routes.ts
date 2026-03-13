import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/send', authMiddleware, messageController.send);
router.post('/react', authMiddleware, messageController.react);

export default router;
