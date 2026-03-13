import { Request, Response } from 'express';
import { mediaService } from '../services/media.service';
import { whatsappService } from '../services/whatsapp.service';

export const mediaController = {
  async upload(req: Request, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }
      const result = await mediaService.upload(req.file.buffer, req.file.mimetype, req.file.originalname);
      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }
      res.json({ mediaId: result.mediaId, filename: req.file.originalname, mimeType: req.file.mimetype });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async getUrl(req: Request, res: Response) {
    try {
      const { mediaId } = req.query;
      if (!mediaId || typeof mediaId !== 'string') {
        return res.status(400).json({ error: 'mediaId query parameter required' });
      }
      const url = await whatsappService.getMediaUrl(mediaId);
      res.json({ url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
