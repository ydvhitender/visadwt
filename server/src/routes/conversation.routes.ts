import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', conversationController.create);
router.get('/', conversationController.list);
router.get('/:id', conversationController.getById);
router.get('/:id/messages', conversationController.getMessages);
router.patch('/:id/assign', conversationController.assign);
router.patch('/:id/status', conversationController.updateStatus);
router.patch('/:id/read', conversationController.markRead);
router.delete('/:id', conversationController.remove);

export default router;
