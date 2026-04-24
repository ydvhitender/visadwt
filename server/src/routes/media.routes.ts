import { Router } from 'express';
import multer from 'multer';
import { mediaController } from '../controllers/media.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit
});

const router = Router();

// Public media proxy — browser tags can't send auth headers
router.get('/:mediaId', mediaController.proxy);

// Authenticated routes
router.use(authMiddleware);
router.post('/upload', upload.single('file'), mediaController.upload);
router.get('/url', mediaController.getUrl);

export default router;
