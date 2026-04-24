import { Request, Response } from 'express';
import { mediaService } from '../services/media.service';
import { whatsappService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
      const proxyUrl = `/api/media/${mediaId}`;
      res.json({ url: proxyUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async proxy(req: Request, res: Response) {
    try {
      const { mediaId } = req.params;
      if (!mediaId) {
        return res.status(400).json({ error: 'mediaId is required' });
      }

      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
        ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
        pdf: 'application/pdf', doc: 'application/msword',
      };

      // Check local cache first
      const cachedFiles = fs.readdirSync(UPLOADS_DIR).filter(f => f.startsWith(mediaId as string));
      if (cachedFiles.length > 0) {
        const filePath = path.join(UPLOADS_DIR, cachedFiles[0]);
        const ext = path.extname(cachedFiles[0]).slice(1).toLowerCase();
        const contentType = mimeMap[ext] || 'application/octet-stream';
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.set('Cache-Control', 'public, max-age=604800');
        res.set('Accept-Ranges', 'bytes');
        res.set('Content-Type', contentType);

        // Handle byte-range requests (required for HTML5 video)
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunkSize = end - start + 1;
          res.status(206);
          res.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.set('Content-Length', String(chunkSize));
          const stream = fs.createReadStream(filePath, { start, end });
          stream.pipe(res);
          return;
        }

        res.set('Content-Length', String(fileSize));
        return res.sendFile(filePath);
      }

      // Fetch from WhatsApp API
      const url = await whatsappService.getMediaUrl(mediaId as string);
      const buffer = await whatsappService.downloadMedia(url);

      // Detect extension from content
      let ext = 'bin';
      const header = buffer.slice(0, 12);
      if (header[0] === 0xFF && header[1] === 0xD8) ext = 'jpg';
      else if (header[0] === 0x89 && header[1] === 0x50) ext = 'png';
      else if (header[0] === 0x47 && header[1] === 0x49) ext = 'gif';
      else if (header[0] === 0x52 && header[1] === 0x49 && header[8] === 0x57) ext = 'webp';
      else if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
        // MP4/MOV: ftyp box
        const brand = header.slice(8, 12).toString('ascii');
        ext = brand.startsWith('qt') ? 'mov' : 'mp4';
      }
      else if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) ext = 'webm';
      else if (header[0] === 0x4F && header[1] === 0x67) ext = 'ogg';
      else if (header[0] === 0xFF && (header[1] === 0xFB || header[1] === 0xF3 || header[1] === 0xF2)) ext = 'mp3';
      else if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) ext = 'mp3';
      else if (header[0] === 0x25 && header[1] === 0x50) ext = 'pdf';

      // Save to local cache
      const filename = `${mediaId}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Accept-Ranges', 'bytes');
      res.set('Content-Type', mimeMap[ext] || 'application/octet-stream');
      res.set('Content-Length', String(buffer.length));
      res.send(buffer);
    } catch (error: any) {
      logger.warn(`Media proxy failed for ${req.params.mediaId}: ${error.message}`);
      // Return a placeholder image on failure
      res.set('Content-Type', 'image/svg+xml');
      res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#e5e7eb" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui" font-size="12" fill="#6b7280">Media unavailable</text></svg>`);
    }
  },
};
