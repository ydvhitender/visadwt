import { Contact } from '../models/Contact';
import { Conversation } from '../models/Conversation';
import { Message, MessageType } from '../models/Message';
import { getIO } from '../config/socket';
import { normalizePhone, formatPhone } from '../utils/phone';
import { whatsappService } from './whatsapp.service';
import { flowService } from './flow.service';
import { logger } from '../utils/logger';
import type { WebhookValue, WebhookMessage, WebhookStatus, WebhookContact } from '../types/webhook.types';

class WebhookService {
  async processWebhookValue(value: WebhookValue) {
    if (value.messages && value.contacts) {
      for (let i = 0; i < value.messages.length; i++) {
        const message = value.messages[i];
        const contactInfo = value.contacts[i] || value.contacts[0];
        await this.handleIncomingMessage(message, contactInfo);
      }
    }

    if (value.statuses) {
      for (const status of value.statuses) {
        await this.handleStatusUpdate(status);
      }
    }
  }

  private async handleIncomingMessage(waMessage: WebhookMessage, contactInfo: WebhookContact) {
    try {
      const waId = normalizePhone(waMessage.from);

      // Find or create contact
      let contact = await Contact.findOne({ waId });
      if (!contact) {
        contact = await Contact.create({
          waId,
          phoneNumber: formatPhone(waMessage.from),
          profileName: contactInfo.profile.name,
          name: contactInfo.profile.name,
        });
      } else if (contactInfo.profile.name && contact.profileName !== contactInfo.profile.name) {
        contact.profileName = contactInfo.profile.name;
        await contact.save();
      }

      // Find or create conversation
      let conversation = await Conversation.findOne({ contact: contact._id, status: { $ne: 'closed' } });
      if (!conversation) {
        conversation = await Conversation.create({ contact: contact._id, status: 'open' });
      }

      // Update 24h window
      const now = new Date();
      conversation.lastInboundAt = now;
      conversation.windowExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      conversation.isWithinWindow = true;

      // Determine message type and content
      const messageType = this.getMessageType(waMessage);
      const messageData: any = {
        conversation: conversation._id,
        contact: contact._id,
        waMessageId: waMessage.id,
        direction: 'inbound',
        type: messageType,
        status: 'delivered',
        timestamp: new Date(parseInt(waMessage.timestamp) * 1000),
      };

      // Populate content fields
      if (waMessage.text) {
        messageData.text = { body: waMessage.text.body };
      }
      if (waMessage.image || waMessage.video || waMessage.audio || waMessage.document || waMessage.sticker) {
        const media = waMessage.image || waMessage.video || waMessage.audio || waMessage.sticker;
        const doc = waMessage.document;
        const mediaSource = doc || media;
        if (mediaSource) {
          // Resolve media URL from WhatsApp and cache locally
          let mediaUrl: string | undefined;
          try {
            mediaUrl = await whatsappService.getMediaUrl(mediaSource.id);
            // Download and cache locally
            const buffer = await whatsappService.downloadMedia(mediaUrl);
            const fs = await import('fs');
            const path = await import('path');
            const uploadsDir = path.default.join(__dirname, '../../uploads');
            if (!fs.default.existsSync(uploadsDir)) {
              fs.default.mkdirSync(uploadsDir, { recursive: true });
            }
            let ext = 'bin';
            const mime = mediaSource.mime_type || '';
            if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
            else if (mime.includes('png')) ext = 'png';
            else if (mime.includes('webp')) ext = 'webp';
            else if (mime.includes('gif')) ext = 'gif';
            else if (mime.includes('mp4')) ext = 'mp4';
            else if (mime.includes('ogg')) ext = 'ogg';
            else if (mime.includes('pdf')) ext = 'pdf';
            else if (mime.includes('audio')) ext = 'ogg';
            fs.default.writeFileSync(path.default.join(uploadsDir, `${mediaSource.id}.${ext}`), buffer);
            logger.info(`Media cached locally: ${mediaSource.id}.${ext}`);
          } catch (err) {
            logger.warn(`Failed to resolve/cache media for ${mediaSource.id}:`, err);
          }
          messageData.media = {
            mediaId: mediaSource.id,
            url: `/api/media/${mediaSource.id}`,
            mimeType: mediaSource.mime_type,
            sha256: mediaSource.sha256,
            caption: mediaSource.caption,
            filename: doc?.filename,
          };
        }
      }
      if (waMessage.location) {
        messageData.location = waMessage.location;
      }
      if (waMessage.interactive) {
        messageData.interactive = {
          type: waMessage.interactive.type,
          buttonReply: waMessage.interactive.button_reply,
          listReply: waMessage.interactive.list_reply,
        };
      }
      if (waMessage.contacts) {
        messageData.contacts = waMessage.contacts.map((c: any) => ({
          name: c.name,
          phones: c.phones,
          emails: c.emails,
        }));
      }
      if (waMessage.context) {
        messageData.context = { messageId: waMessage.context.id };
      }

      // Handle reactions: update the target message instead of creating a new one
      if (waMessage.reaction) {
        const targetMsg = await Message.findOne({ waMessageId: waMessage.reaction.message_id });
        if (targetMsg) {
          if (waMessage.reaction.emoji) {
            // Add or update reaction
            const existingIdx = (targetMsg.reactions || []).findIndex(
              (r: any) => r.waId === waId
            );
            if (existingIdx >= 0) {
              targetMsg.reactions![existingIdx].emoji = waMessage.reaction.emoji;
            } else {
              if (!targetMsg.reactions) targetMsg.reactions = [];
              targetMsg.reactions.push({
                emoji: waMessage.reaction.emoji,
                waId,
                reactedAt: new Date(),
              });
            }
          } else {
            // Empty emoji = remove reaction
            targetMsg.reactions = (targetMsg.reactions || []).filter(
              (r: any) => r.waId !== waId
            );
          }
          await targetMsg.save();

          const io = getIO();
          io.to(`conversation:${targetMsg.conversation}`).emit('message_reaction', {
            messageId: targetMsg._id,
            reactions: targetMsg.reactions,
          });
        }
        return; // Don't create a new message for reactions
      }

      const message = await Message.create(messageData);

      // Update conversation
      const previewText = this.getPreviewText(waMessage, messageType);
      conversation.lastMessage = {
        text: previewText,
        timestamp: message.timestamp,
        direction: 'inbound',
      };
      conversation.unreadCount += 1;
      conversation.status = 'open';
      await conversation.save();

      // Emit Socket.IO events
      const io = getIO();
      const populatedMessage = await Message.findById(message._id).populate('contact');
      const populatedConversation = await Conversation.findById(conversation._id)
        .populate('contact')
        .populate('assignedTo', '-password');

      io.emit('new_message', {
        message: populatedMessage,
        conversation: populatedConversation,
      });

      logger.info(`Incoming message from ${waId}: ${messageType}`);

      // Trigger flow automation
      try {
        if (messageType === 'text' && waMessage.text?.body) {
          await flowService.handleIncomingText(conversation._id.toString(), waMessage.text.body);
        } else if (waMessage.interactive?.button_reply) {
          await flowService.handleButtonClick(
            conversation._id.toString(),
            waMessage.interactive.button_reply.id,
            waMessage.interactive.button_reply.title
          );
        }
      } catch (err) {
        logger.warn('Flow automation error:', err);
      }
    } catch (error) {
      logger.error('Error handling incoming message:', error);
    }
  }

  private async handleStatusUpdate(status: WebhookStatus) {
    try {
      const message = await Message.findOne({ waMessageId: status.id });
      if (!message) return;

      const statusMap: Record<string, string> = {
        sent: 'sent',
        delivered: 'delivered',
        read: 'read',
        failed: 'failed',
      };

      const newStatus = statusMap[status.status];
      if (!newStatus) return;

      message.status = newStatus as any;
      if (status.status === 'sent') message.sentAt = new Date(parseInt(status.timestamp) * 1000);
      if (status.status === 'delivered') message.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
      if (status.status === 'read') message.readAt = new Date(parseInt(status.timestamp) * 1000);
      if (status.status === 'failed' && status.errors?.[0]) {
        message.failedReason = status.errors[0].message;
      }
      await message.save();

      const io = getIO();
      io.emit('message_status', {
        messageId: message._id,
        waMessageId: status.id,
        status: newStatus,
        conversationId: message.conversation.toString(),
      });

      logger.debug(`Status update: ${status.id} -> ${status.status}`);
    } catch (error) {
      logger.error('Error handling status update:', error);
    }
  }

  private getMessageType(waMessage: WebhookMessage): MessageType {
    if (waMessage.text) return 'text';
    if (waMessage.image) return 'image';
    if (waMessage.video) return 'video';
    if (waMessage.audio) return 'audio';
    if (waMessage.document) return 'document';
    if (waMessage.location) return 'location';
    if (waMessage.interactive) return 'interactive';
    if (waMessage.sticker) return 'sticker';
    if (waMessage.reaction) return 'reaction';
    return 'text';
  }

  private getPreviewText(waMessage: WebhookMessage, type: MessageType): string {
    if (waMessage.text) return waMessage.text.body;
    if (waMessage.interactive?.button_reply) return waMessage.interactive.button_reply.title;
    if (waMessage.interactive?.list_reply) return waMessage.interactive.list_reply.title;
    const mediaLabels: Record<string, string> = {
      image: 'Photo',
      video: 'Video',
      audio: 'Audio',
      document: 'Document',
      sticker: 'Sticker',
      location: 'Location',
      reaction: 'Reaction',
    };
    return mediaLabels[type] || 'Message';
  }
}

export const webhookService = new WebhookService();
