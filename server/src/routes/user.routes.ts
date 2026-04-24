import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/auth.middleware';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();

// Serve avatars publicly (no auth needed for <img> tags)
router.get('/avatar/:filename', (req: Request<{ filename: string }>, res: Response) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.set('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

router.use(authMiddleware);

// Avatar upload (auth required)
router.post('/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Remove old avatar files for this user
    const prefix = `avatar-${userId}`;
    fs.readdirSync(UPLOADS_DIR).filter(f => f.startsWith(prefix)).forEach(f => {
      fs.unlinkSync(path.join(UPLOADS_DIR, f));
    });

    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `${prefix}${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), req.file.buffer);

    const avatarUrl = `/api/users/avatar/${filename}`;
    await User.findByIdAndUpdate(userId, { avatar: avatarUrl });

    res.json({ avatar: avatarUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await User.find().select('-password').sort({ name: 1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const user = await User.create({ name, email, password, role: role || 'agent' });
    const { password: _, ...userObj } = user.toObject();
    res.status(201).json(userObj);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, email, role } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...(name && { name }), ...(email && { email }), ...(role && { role }) },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
