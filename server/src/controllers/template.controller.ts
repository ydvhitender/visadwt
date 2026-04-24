import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import { messageService } from '../services/message.service';
import { AuthRequest } from '../middleware/auth.middleware';

export const templateController = {
  async list(_req: Request, res: Response) {
    try {
      const templates = await whatsappService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, language, category, components } = req.body;
      if (!name || !language || !category) {
        return res.status(400).json({ error: 'name, language, and category are required' });
      }
      const result = await whatsappService.createTemplate({
        name,
        language,
        category,
        components: components || [],
      });
      res.status(201).json(result);
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      res.status(400).json({ error: msg });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const { components } = req.body;
      if (!components) {
        return res.status(400).json({ error: 'components are required' });
      }
      const result = await whatsappService.editTemplate(templateId as string, components);
      res.json(result);
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      res.status(400).json({ error: msg });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const { templateName } = req.params;
      const result = await whatsappService.deleteTemplate(templateName as string);
      res.json(result);
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || error.message;
      res.status(400).json({ error: msg });
    }
  },

  async send(req: AuthRequest, res: Response) {
    try {
      const result = await messageService.send({
        conversationId: req.body.conversationId,
        type: 'template',
        sentBy: req.user!.id,
        templateName: req.body.templateName,
        templateLanguage: req.body.language,
        templateComponents: req.body.components,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};
