import { Router, Response } from 'express';
import { Flow } from '../models/Flow';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

// List flows for the current user only
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const flows = await Flow.find({ createdBy: req.user!.id }).sort({ priority: -1, createdAt: -1 });
    res.json(flows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create flow — always tied to the current user
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const flow = await Flow.create({
      ...req.body,
      createdBy: req.user!.id,
    });
    res.status(201).json(flow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update — only if owned by current user
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const flow = await Flow.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user!.id },
      req.body,
      { new: true }
    );
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json(flow);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete — only if owned by current user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const flow = await Flow.findOneAndDelete({ _id: req.params.id, createdBy: req.user!.id });
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
