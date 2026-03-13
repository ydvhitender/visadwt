import { Conversation, IConversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { getIO } from '../config/socket';
import { whatsappService } from './whatsapp.service';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

class ConversationService {
  async list(filters: {
    status?: string;
    assignedTo?: string;
    search?: string;
    tag?: string;
    page?: number;
    limit?: number;
  }) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.assignedTo === 'unassigned') {
      query.assignedTo = null;
    } else if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }
    if (filters.tag) query.tags = filters.tag;

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    let conversationQuery = Conversation.find(query)
      .populate('contact')
      .populate('assignedTo', '-password')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const [conversations, total] = await Promise.all([
      conversationQuery.exec(),
      Conversation.countDocuments(query),
    ]);

    // If there's a search term, filter by contact name/phone after populate
    let filtered = conversations;
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = conversations.filter((c: any) => {
        const contact = c.contact;
        return (
          contact?.name?.toLowerCase().includes(term) ||
          contact?.profileName?.toLowerCase().includes(term) ||
          contact?.phoneNumber?.includes(term) ||
          contact?.waId?.includes(term)
        );
      });
    }

    return { conversations: filtered, total, page, limit };
  }

  async getById(id: string) {
    const conversation = await Conversation.findById(id)
      .populate('contact')
      .populate('assignedTo', '-password');
    return conversation;
  }

  async getMessages(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const messages = await Message.find({ conversation: conversationId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sentBy', 'name avatar');

    const total = await Message.countDocuments({ conversation: conversationId });

    return { messages: messages.reverse(), total, page, limit };
  }

  async assign(conversationId: string, agentId: string | null) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    // Update active conversation counts
    if (conversation.assignedTo) {
      await User.findByIdAndUpdate(conversation.assignedTo, { $inc: { activeConversations: -1 } });
    }
    if (agentId) {
      await User.findByIdAndUpdate(agentId, { $inc: { activeConversations: 1 } });
    }

    conversation.assignedTo = agentId ? new Types.ObjectId(agentId) : undefined;
    await conversation.save();

    const populated = await Conversation.findById(conversationId)
      .populate('contact')
      .populate('assignedTo', '-password');

    const io = getIO();
    io.emit('conversation_assigned', { conversation: populated });

    return populated;
  }

  async updateStatus(conversationId: string, status: 'open' | 'closed' | 'pending') {
    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { status },
      { new: true }
    )
      .populate('contact')
      .populate('assignedTo', '-password');
    return conversation;
  }

  async markRead(conversationId: string) {
    await Conversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });

    // Send read receipts to WhatsApp for recent unread inbound messages
    try {
      const unreadMessages = await Message.find({
        conversation: conversationId,
        direction: 'inbound',
        status: { $ne: 'read' },
        waMessageId: { $exists: true, $ne: null },
      })
        .sort({ timestamp: -1 })
        .limit(20);

      for (const msg of unreadMessages) {
        try {
          await whatsappService.markAsRead(msg.waMessageId!);
          msg.status = 'read' as any;
          msg.readAt = new Date();
          await msg.save();
        } catch {
          // Silently skip if marking individual message fails
        }
      }
    } catch (err) {
      logger.warn('Failed to send read receipts:', err);
    }
  }
}

export const conversationService = new ConversationService();
