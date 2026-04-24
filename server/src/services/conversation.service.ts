import { Conversation, IConversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { getIO } from '../config/socket';
import { whatsappService } from './whatsapp.service';
import { getMysqlPool } from '../config/mysql';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

class ConversationService {
  // Enrich conversations with SQL traveler data (name + status as tag)
  private async enrichWithSqlData(conversations: any[]) {
    if (conversations.length === 0) return conversations;
    try {
      const pool = getMysqlPool();
      // Collect all phone numbers (must be at least 7 digits)
      const phoneNumbers = conversations
        .map((c: any) => {
          const raw = c.contact?.waId || c.contact?.phoneNumber || '';
          const clean = raw.replace(/[\s\-\(\)\+]/g, '');
          return clean.length >= 7 ? clean : null;
        })
        .filter(Boolean) as string[];

      if (phoneNumbers.length === 0) return conversations;

      // Build query to match last 10 digits
      const conditions = phoneNumbers.map(() =>
        `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(whatsapp_contact, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') LIKE ?`
      ).join(' OR ');

      const params = phoneNumbers.map((p: string) => `%${p.slice(-10)}`);

      const [rows] = await pool.execute(
        `SELECT t.id, t.name, t.first_name, t.last_name, t.whatsapp_contact, t.status, t.travel_country, t.visa_center, t.package, t.visa_type,
                (SELECT COUNT(*) FROM dependents d WHERE d.traveler_id = t.id) as dependent_count
         FROM travelers t WHERE t.whatsapp_contact IS NOT NULL AND t.whatsapp_contact != '' AND (${conditions})
         ORDER BY t.id DESC`,
        params
      );

      const travelers = rows as any[];

      // Build a map: last 10 digits of phone -> traveler
      const travelerMap = new Map<string, any>();
      for (const t of travelers) {
        if (t.whatsapp_contact) {
          const key = t.whatsapp_contact.replace(/[\s\-\(\)\+]/g, '').slice(-10);
          if (key.length >= 7 && !travelerMap.has(key)) {
            travelerMap.set(key, t);
          }
        }
      }

      // Enrich each conversation
      for (const conv of conversations) {
        const contact = conv.contact;
        if (!contact) continue;
        const phoneClean = (contact.waId || contact.phoneNumber || '').replace(/[\s\-\(\)\+]/g, '');
        if (phoneClean.length < 7) continue;
        const key = phoneClean.slice(-10);
        const traveler = travelerMap.get(key);
        if (traveler) {
          // Set name from SQL if not already set
          const sqlName = traveler.name || `${traveler.first_name || ''} ${traveler.last_name || ''}`.trim();
          if (sqlName && sqlName !== 'New Traveler') {
            contact.name = sqlName;
            contact.profileName = contact.profileName || sqlName;
          }
          // Add SQL status as tag if present
          if (traveler.status) {
            conv._doc = conv._doc || conv;
            const tags = conv._doc.tags || conv.tags || [];
            if (!tags.includes(traveler.status)) {
              if (conv._doc.tags) {
                conv._doc.tags = [traveler.status, ...tags.filter((t: string) => t !== traveler.status)];
              } else {
                conv.tags = [traveler.status, ...tags.filter((t: string) => t !== traveler.status)];
              }
            }
            // Store traveler ID for reference
            const doc = conv._doc || conv;
            doc.travelerId = traveler.id;
          }
          // Add travel info
          const doc = conv._doc || conv;
          if (traveler.travel_country) doc.travelCountry = traveler.travel_country;
          if (traveler.visa_center) doc.visaCenter = traveler.visa_center;
          if (traveler.package) doc.travelPackage = traveler.package;
          if (traveler.visa_type) doc.visaType = traveler.visa_type;
          if (traveler.dependent_count != null) doc.dependentCount = Number(traveler.dependent_count);
        }
      }
    } catch (err) {
      logger.warn('Failed to enrich with SQL data:', err);
    }
    return conversations;
  }

  async create(phoneNumber: string) {
    // Normalize: remove spaces, dashes, leading +
    const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');

    // Check if contact already exists
    let contact = await Contact.findOne({ waId: normalized });
    if (!contact) {
      contact = await Contact.create({
        waId: normalized,
        phoneNumber: phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`,
      });
    }

    // Check if conversation already exists for this contact
    let conversation = await Conversation.findOne({ contact: contact._id })
      .populate('contact')
      .populate('assignedTo', '-password');

    if (conversation) {
      return conversation;
    }

    // Create new conversation
    conversation = await Conversation.create({
      contact: contact._id,
      status: 'open',
      unreadCount: 0,
    });

    return Conversation.findById(conversation._id)
      .populate('contact')
      .populate('assignedTo', '-password');
  }

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
    const limit = filters.limit || 1000;
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

    // Recalculate 24h window status based on actual last inbound message
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (conversations.length > 0) {
      const convIds = conversations.map((c: any) => c._id);
      // Find most recent inbound message per conversation
      const recentInbounds = await Message.aggregate([
        {
          $match: {
            conversation: { $in: convIds },
            direction: 'inbound',
            timestamp: { $gte: twentyFourHoursAgo },
          },
        },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$conversation',
            lastInboundAt: { $first: '$timestamp' },
          },
        },
      ]);
      const inboundMap = new Map<string, Date>();
      for (const r of recentInbounds) {
        inboundMap.set(String(r._id), r.lastInboundAt);
      }

      for (const conv of conversations) {
        const doc = (conv as any)._doc || conv;
        const lastInbound = inboundMap.get(String(conv._id));
        if (lastInbound) {
          doc.lastInboundAt = lastInbound;
          doc.windowExpiresAt = new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000);
          doc.isWithinWindow = true;
        } else {
          doc.isWithinWindow = false;
          doc.windowExpiresAt = undefined;
        }
      }
    }

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

    // Enrich with SQL data
    const enriched = await this.enrichWithSqlData(filtered);

    return { conversations: enriched, total, page, limit };
  }

  async getById(id: string) {
    const conversation = await Conversation.findById(id)
      .populate('contact')
      .populate('assignedTo', '-password');
    if (conversation) {
      // Recalculate window based on last inbound message
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const lastInbound = await Message.findOne({
        conversation: conversation._id,
        direction: 'inbound',
        timestamp: { $gte: twentyFourHoursAgo },
      }).sort({ timestamp: -1 });

      const doc = (conversation as any)._doc || conversation;
      if (lastInbound) {
        doc.lastInboundAt = lastInbound.timestamp;
        doc.windowExpiresAt = new Date(lastInbound.timestamp.getTime() + 24 * 60 * 60 * 1000);
        doc.isWithinWindow = true;
      } else {
        doc.isWithinWindow = false;
        doc.windowExpiresAt = undefined;
      }

      await this.enrichWithSqlData([conversation]);
    }
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

  async remove(conversationId: string) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Conversation not found');
    await Message.deleteMany({ conversation: conversationId });
    await Conversation.findByIdAndDelete(conversationId);
  }
}

export const conversationService = new ConversationService();
