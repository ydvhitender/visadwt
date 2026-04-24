import { Response } from 'express';
import { Tag } from '../models/Tag';
import { Conversation } from '../models/Conversation';
import { AuthRequest } from '../middleware/auth.middleware';

export const tagController = {
  async list(req: AuthRequest, res: Response) {
    try {
      const tags = await Tag.find().sort({ name: 1 });
      res.json(tags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: AuthRequest, res: Response) {
    try {
      const tag = await Tag.create({
        ...req.body,
        createdBy: req.user!.id,
      });
      res.status(201).json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const oldTag = await Tag.findById(req.params.id);
      if (!oldTag) return res.status(404).json({ error: 'Tag not found' });
      const oldName = oldTag.name;
      const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, { new: true });
      // Update name in all conversations if name changed
      if (req.body.name && req.body.name !== oldName) {
        await Conversation.updateMany(
          { tags: oldName },
          { $set: { 'tags.$': req.body.name } }
        );
      }
      res.json(tag);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const tag = await Tag.findByIdAndDelete(req.params.id);
      if (!tag) return res.status(404).json({ error: 'Tag not found' });
      // Remove from all conversations
      await Conversation.updateMany(
        { tags: tag.name },
        { $pull: { tags: tag.name } }
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateConversationTags(req: AuthRequest, res: Response) {
    try {
      const { conversationId } = req.params;
      const { add, remove } = req.body;

      const updates: any = {};
      if (add?.length) updates.$addToSet = { tags: { $each: add } };
      if (remove?.length) updates.$pull = { tags: { $in: remove } };

      // Need to run separately if both add and remove
      if (add?.length) {
        await Conversation.findByIdAndUpdate(conversationId, { $addToSet: { tags: { $each: add } } });
      }
      if (remove?.length) {
        await Conversation.findByIdAndUpdate(conversationId, { $pull: { tags: { $in: remove } } });
      }

      const conversation = await Conversation.findById(conversationId)
        .populate('contact')
        .populate('assignedTo', '-password');
      res.json(conversation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
