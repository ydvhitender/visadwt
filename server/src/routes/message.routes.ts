import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/send', authMiddleware, messageController.send);
router.post('/react', authMiddleware, messageController.react);
router.patch('/:id/pin', authMiddleware, messageController.togglePin);
router.delete('/:id', authMiddleware, messageController.deleteForMe);
router.delete('/:id/everyone', authMiddleware, messageController.deleteForEveryone);

export default router;
