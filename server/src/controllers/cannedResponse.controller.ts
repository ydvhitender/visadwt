import { Response } from 'express';
import { CannedResponse } from '../models/CannedResponse';
import { AuthRequest } from '../middleware/auth.middleware';

export const cannedResponseController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const { search } = req.query;
      const query: any = {
        $or: [{ isGlobal: true }, { createdBy: req.user!.id }],
      };
      if (search) {
        query.$and = [
          { $or: [
            { title: { $regex: search, $options: 'i' } },
            { shortcut: { $regex: search, $options: 'i' } },
            { body: { $regex: search, $options: 'i' } },
          ]},
        ];
      }
      const responses = await CannedResponse.find(query).sort({ title: 1 });
      res.json(responses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const response = await CannedResponse.create({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const response = await CannedResponse.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!response) return res.status(404).json({ error: 'Not found' });
      res.json(response);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      await CannedResponse.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
