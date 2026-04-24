import { Response } from 'express';
import { conversationService } from '../services/conversation.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const conversationController = {
  async create(req: AuthRequest, res: Response) {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });
      const conversation = await conversationService.create(phoneNumber);
      res.status(201).json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: AuthRequest, res: Response) {
    try {
      const { status, assignedTo, search, page, limit } = req.query;
      const result = await conversationService.list({
        status: status as string,
        assignedTo: assignedTo as string,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const conversation = await conversationService.getById(id);
      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getMessages(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { page, limit } = req.query;
      const result = await conversationService.getMessages(
        id,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async assign(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { agentId } = req.body;
      const conversation = await conversationService.assign(id, agentId);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const { status } = req.body;
      const conversation = await conversationService.updateStatus(id, status);
      res.json(conversation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async markRead(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      await conversationService.markRead(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      await conversationService.remove(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
