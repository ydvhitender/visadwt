import { Request, Response } from 'express';
import { env } from '../config/env';
import { webhookService } from '../services/webhook.service';
import { logger } from '../utils/logger';
import type { WebhookPayload } from '../types/webhook.types';

export const webhookController = {
  verify(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WA_WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      return res.status(200).send(challenge);
    }
    logger.warn('Webhook verification failed');
    return res.sendStatus(403);
  },

  async handleIncoming(req: Request, res: Response) {
    // Always respond 200 immediately to acknowledge receipt
    res.sendStatus(200);

    try {
      logger.info('Webhook received: ' + JSON.stringify(req.body).substring(0, 500));
      const payload = req.body as WebhookPayload;
      if (payload.object !== 'whatsapp_business_account') return;

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await webhookService.processWebhookValue(change.value);
          }
        }
      }
    } catch (error) {
      logger.error('Error processing webhook:', error);
    }
  },
};
