import { Request, Response } from 'express';
import { messageService } from '../services/message.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { whatsappService } from '../services/whatsapp.service';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

export const messageController = {
  async send(req: AuthRequest, res: Response) {
    try {
      const result = await messageService.send({
        ...req.body,
        sentBy: req.user!.id,
      });
      res.json(result);
    } catch (error: any) {
      logger.error('Message send error', { message: error.message, stack: error.stack, body: req.body });
      res.status(400).json({ error: error.message });
    }
  },

  async react(req: AuthRequest, res: Response) {
    try {
      const { messageId, emoji } = req.body;
      if (!messageId || !emoji) {
        return res.status(400).json({ error: 'messageId and emoji are required' });
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Send reaction via WhatsApp if message has a waMessageId
      if (message.waMessageId) {
        const contact = await Contact.findById(message.contact);
        if (contact) {
          await whatsappService.sendReaction(contact.waId, message.waMessageId, emoji);
        }
      }

      // Update local reactions
      if (!message.reactions) message.reactions = [];
      const userId = req.user!.id;
      const existingIdx = message.reactions.findIndex(
        (r: any) => r.reactedBy?.toString() === userId
      );
      if (existingIdx >= 0) {
        message.reactions[existingIdx].emoji = emoji;
      } else {
        message.reactions.push({
          emoji,
          reactedBy: new Types.ObjectId(userId),
          reactedAt: new Date(),
        });
      }
      await message.save();

      const io = getIO();
      io.to(`conversation:${message.conversation}`).emit('message_reaction', {
        messageId: message._id,
        reactions: message.reactions,
      });

      res.json({ success: true, reactions: message.reactions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async togglePin(req: AuthRequest, res: Response) {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ error: 'Message not found' });
      message.pinned = !message.pinned;
      await message.save();
      res.json({ success: true, pinned: message.pinned });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteForMe(req: AuthRequest, res: Response) {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ error: 'Message not found' });
      const conversationId = message.conversation.toString();

      await Message.findByIdAndDelete(req.params.id);

      // Update conversation lastMessage if needed
      const lastMsg = await Message.findOne({ conversation: conversationId })
        .sort({ timestamp: -1 });
      if (lastMsg) {
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text: lastMsg.text?.body || lastMsg.media?.caption || lastMsg.type || '',
            timestamp: lastMsg.timestamp,
            direction: lastMsg.direction,
          },
        });
      }

      const io = getIO();
      io.to(`conversation:${conversationId}`).emit('message_deleted', {
        messageId: req.params.id,
        conversationId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async deleteForEveryone(req: AuthRequest, res: Response) {
    try {
      const message = await Message.findById(req.params.id);
      if (!message) return res.status(404).json({ error: 'Message not found' });

      const conversationId = message.conversation.toString();

      // Mark as deleted using updateOne to properly unset fields
      await Message.updateOne(
        { _id: req.params.id },
        {
          $set: {
            type: 'text',
            text: { body: 'This message was deleted' },
          },
          $unset: {
            media: 1,
            interactive: 1,
            template: 1,
            location: 1,
            contacts: 1,
            reactions: 1,
          },
        }
      );

      // Update conversation lastMessage
      const lastMsg = await Message.findOne({ conversation: conversationId })
        .sort({ timestamp: -1 });
      if (lastMsg) {
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: {
            text: lastMsg.text?.body || lastMsg.type || '',
            timestamp: lastMsg.timestamp,
            direction: lastMsg.direction,
          },
        });
      }

      const io = getIO();
      io.emit('message_deleted_everyone', {
        messageId: req.params.id,
        conversationId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
