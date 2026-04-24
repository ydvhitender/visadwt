import { Router } from 'express';
import { templateController } from '../controllers/template.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', templateController.list);
router.post('/', templateController.create);
router.post('/send', templateController.send);
router.put('/:templateId', templateController.update);
router.delete('/:templateName', templateController.remove);

export default router;
