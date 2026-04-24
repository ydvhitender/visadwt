import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { whatsappService } from './whatsapp.service';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';
import { Types } from 'mongoose';

interface SendOptions {
  conversationId: string;
  type: string;
  sentBy: string;
  // Text
  text?: string;
  // Media
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  // Location
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  // Interactive buttons
  buttons?: Array<{ id: string; title: string }>;
  headerText?: string;
  footerText?: string;
  // Interactive list
  listButtonText?: string;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  // Template
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<Record<string, unknown>>;
  // Reply
  replyToMessageId?: string;
}

class MessageService {
  async send(options: SendOptions) {
    const conversation = await Conversation.findById(options.conversationId).populate('contact');
    if (!conversation) throw new Error('Conversation not found');

    const contact = await Contact.findById(conversation.contact);
    if (!contact) throw new Error('Contact not found');

    const to = contact.waId;
    let waResult: any;
    let previewText = '';

    // Resolve reply context — get the WhatsApp message ID for the reply
    let replyWaMessageId: string | undefined;
    if (options.replyToMessageId) {
      const replyMsg = await Message.findById(options.replyToMessageId);
      if (replyMsg?.waMessageId) {
        replyWaMessageId = replyMsg.waMessageId;
      }
    }

    switch (options.type) {
      case 'text':
        waResult = await whatsappService.sendText(to, options.text!, false, replyWaMessageId);
        previewText = options.text!;
        break;

      case 'image':
        waResult = await whatsappService.sendImage(to, options.mediaId || options.mediaUrl!, options.caption, replyWaMessageId);
        previewText = options.caption || 'Photo';
        break;

      case 'video':
        waResult = await whatsappService.sendVideo(to, options.mediaId || options.mediaUrl!, options.caption, replyWaMessageId);
        previewText = options.caption || 'Video';
        break;

      case 'document':
        waResult = await whatsappService.sendDocument(
          to,
          options.mediaId || options.mediaUrl!,
          options.filename || 'document',
          options.caption,
          replyWaMessageId
        );
        previewText = options.filename || 'Document';
        break;

      case 'audio':
        waResult = await whatsappService.sendAudio(to, options.mediaId || options.mediaUrl!, replyWaMessageId);
        previewText = 'Audio';
        break;

      case 'location':
        waResult = await whatsappService.sendLocation(
          to,
          options.latitude!,
          options.longitude!,
          options.locationName,
          options.locationAddress
        );
        previewText = options.locationName || 'Location';
        break;

      case 'buttons':
        waResult = await whatsappService.sendButtons(
          to,
          options.text!,
          options.buttons!,
          options.headerText,
          options.footerText
        );
        previewText = options.text!;
        break;

      case 'list':
        waResult = await whatsappService.sendList(
          to,
          options.text!,
          options.listButtonText!,
          options.sections!,
          options.headerText,
          options.footerText
        );
        previewText = options.text!;
        break;

      case 'template':
        waResult = await whatsappService.sendTemplate(
          to,
          options.templateName!,
          options.templateLanguage || 'en',
          options.templateComponents
        );
        previewText = `Template: ${options.templateName}`;
        break;

      default:
        throw new Error(`Unsupported message type: ${options.type}`);
    }

    if (!waResult.success) {
      throw new Error(waResult.error || 'Failed to send message');
    }

    // Determine the stored message type
    const storedType = options.type === 'buttons' || options.type === 'list' ? 'interactive' : options.type;

    // Save message to DB
    const message = await Message.create({
      conversation: conversation._id,
      contact: contact._id,
      waMessageId: waResult.messageId,
      direction: 'outbound',
      type: storedType,
      status: 'sent',
      timestamp: new Date(),
      sentBy: new Types.ObjectId(options.sentBy),
      sentAt: new Date(),
      ...(options.type === 'text' && { text: { body: options.text } }),
      ...((['image', 'video', 'document', 'audio'].includes(options.type)) && {
        media: {
          mediaId: options.mediaId,
          url: options.mediaUrl,
          caption: options.caption,
          filename: options.filename,
          mimeType: options.mimeType,
        },
      }),
      ...(options.type === 'location' && {
        location: {
          latitude: options.latitude,
          longitude: options.longitude,
          name: options.locationName,
          address: options.locationAddress,
        },
      }),
      ...((options.type === 'buttons' || options.type === 'list') && {
        interactive: {
          type: options.type === 'buttons' ? 'button' : 'list',
          body: { text: options.text },
          action: options.type === 'buttons'
            ? { buttons: options.buttons }
            : { button: options.listButtonText, sections: options.sections },
        },
      }),
      ...(options.type === 'template' && {
        template: {
          name: options.templateName,
          language: options.templateLanguage || 'en',
          components: options.templateComponents,
        },
      }),
      ...(options.replyToMessageId && {
        context: { messageId: options.replyToMessageId },
      }),
    });

    // Update conversation
    conversation.lastMessage = {
      text: previewText.substring(0, 100),
      timestamp: message.timestamp,
      direction: 'outbound',
    };
    await conversation.save();

    // Emit via Socket.IO
    const io = getIO();
    const populatedMessage = await Message.findById(message._id)
      .populate('sentBy', 'name avatar')
      .populate('contact');

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('contact')
      .populate('assignedTo', '-password');

    io.emit('new_message', {
      message: populatedMessage,
      conversation: populatedConversation,
    });

    return { message: populatedMessage, waMessageId: waResult.messageId };
  }
}

export const messageService = new MessageService();
