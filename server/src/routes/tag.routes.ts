import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', tagController.list);
router.post('/', tagController.create);
router.delete('/:id', tagController.remove);
router.patch('/conversations/:conversationId', tagController.updateConversationTags);

export default router;
