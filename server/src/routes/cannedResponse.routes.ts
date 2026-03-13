import { Router } from 'express';
import { cannedResponseController } from '../controllers/cannedResponse.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/', cannedResponseController.list);
router.post('/', cannedResponseController.create);
router.put('/:id', cannedResponseController.update);
router.delete('/:id', cannedResponseController.remove);

export default router;
