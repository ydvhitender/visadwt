import { Flow, IFlow, IFlowButton } from '../models/Flow';
import { Conversation } from '../models/Conversation';
import { Contact } from '../models/Contact';
import { Message } from '../models/Message';
import { whatsappService } from './whatsapp.service';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';

class FlowService {
  // Get the user whose flows should run for this conversation
  private async getFlowOwner(conversationId: string): Promise<string | null> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return null;
    // If conversation is assigned, use that agent's flows
    if (conversation.assignedTo) return conversation.assignedTo.toString();
    // Otherwise, fall back to any admin user with enabled flows
    const anyFlow = await Flow.findOne({ enabled: true }).sort({ priority: -1 });
    return anyFlow ? anyFlow.createdBy.toString() : null;
  }

  // Check if incoming text triggers a flow
  async handleIncomingText(conversationId: string, text: string) {
    if (!text) return false;
    const ownerId = await this.getFlowOwner(conversationId);
    if (!ownerId) return false;

    const flows = await Flow.find({ enabled: true, createdBy: ownerId }).sort({ priority: -1 });

    const normalized = text.trim().toLowerCase();
    for (const flow of flows) {
      for (const trigger of flow.triggers) {
        const t = trigger.toLowerCase();
        let match = false;
        if (flow.matchType === 'exact') match = normalized === t;
        else if (flow.matchType === 'starts_with') match = normalized.startsWith(t);
        else match = normalized.includes(t);

        if (match) {
          await this.sendFlowMessage(conversationId, flow);
          return true;
        }
      }
    }
    return false;
  }

  // Check if a button click matches a flow button and send the response
  async handleButtonClick(conversationId: string, buttonId: string, buttonTitle: string) {
    const ownerId = await this.getFlowOwner(conversationId);
    if (!ownerId) return false;

    const flows = await Flow.find({ enabled: true, createdBy: ownerId });
    for (const flow of flows) {
      const btn = this.findButton(flow.buttons, buttonId, buttonTitle);
      if (btn && btn.response) {
        await this.sendButtonResponse(conversationId, btn);
        return true;
      }
    }
    return false;
  }

  private findButton(buttons: IFlowButton[], id: string, title: string): IFlowButton | null {
    for (const btn of buttons) {
      if (btn.id === id || btn.title === title) return btn;
      if (btn.response?.buttons) {
        const nested = this.findButton(btn.response.buttons, id, title);
        if (nested) return nested;
      }
    }
    return null;
  }

  private async sendFlowMessage(conversationId: string, flow: IFlow) {
    try {
      const conversation = await Conversation.findById(conversationId).populate('contact');
      if (!conversation) return;
      const contact = conversation.contact as any;
      if (!contact?.waId) return;

      let waResult;
      if (flow.buttons && flow.buttons.length > 0) {
        waResult = await whatsappService.sendButtons(
          contact.waId,
          flow.message.text,
          flow.buttons.map(b => ({ id: b.id, title: b.title })),
          flow.message.headerText,
          flow.message.footerText
        );
      } else {
        waResult = await whatsappService.sendText(contact.waId, flow.message.text);
      }

      if (!waResult.success) {
        logger.warn(`Flow send failed: ${waResult.error}`);
        return;
      }

      const message = await Message.create({
        conversation: conversation._id,
        contact: contact._id,
        waMessageId: waResult.messageId,
        direction: 'outbound',
        type: flow.buttons?.length ? 'interactive' : 'text',
        status: 'sent',
        timestamp: new Date(),
        sentAt: new Date(),
        ...(flow.buttons?.length
          ? {
              interactive: {
                type: 'button',
                body: { text: flow.message.text },
                action: { buttons: flow.buttons.map(b => ({ id: b.id, title: b.title })) },
              },
            }
          : { text: { body: flow.message.text } }),
      });

      conversation.lastMessage = {
        text: flow.message.text.substring(0, 100),
        timestamp: message.timestamp,
        direction: 'outbound',
      };
      await conversation.save();

      const populated = await Message.findById(message._id).populate('contact');
      const populatedConv = await Conversation.findById(conversation._id).populate('contact');
      getIO().emit('new_message', { message: populated, conversation: populatedConv });
      logger.info(`Flow "${flow.name}" triggered for conversation ${conversationId}`);
    } catch (err) {
      logger.error('Error sending flow message:', err);
    }
  }

  private async sendButtonResponse(conversationId: string, btn: IFlowButton) {
    try {
      if (!btn.response?.text) return;
      const conversation = await Conversation.findById(conversationId).populate('contact');
      if (!conversation) return;
      const contact = conversation.contact as any;
      if (!contact?.waId) return;

      let waResult;
      if (btn.response.buttons && btn.response.buttons.length > 0) {
        waResult = await whatsappService.sendButtons(
          contact.waId,
          btn.response.text,
          btn.response.buttons.map(b => ({ id: b.id, title: b.title })),
          btn.response.headerText,
          btn.response.footerText
        );
      } else {
        waResult = await whatsappService.sendText(contact.waId, btn.response.text);
      }

      if (!waResult.success) return;

      const message = await Message.create({
        conversation: conversation._id,
        contact: contact._id,
        waMessageId: waResult.messageId,
        direction: 'outbound',
        type: btn.response.buttons?.length ? 'interactive' : 'text',
        status: 'sent',
        timestamp: new Date(),
        sentAt: new Date(),
        ...(btn.response.buttons?.length
          ? {
              interactive: {
                type: 'button',
                body: { text: btn.response.text },
                action: { buttons: btn.response.buttons.map(b => ({ id: b.id, title: b.title })) },
              },
            }
          : { text: { body: btn.response.text } }),
      });

      conversation.lastMessage = {
        text: btn.response.text.substring(0, 100),
        timestamp: message.timestamp,
        direction: 'outbound',
      };
      await conversation.save();

      const populated = await Message.findById(message._id).populate('contact');
      const populatedConv = await Conversation.findById(conversation._id).populate('contact');
      getIO().emit('new_message', { message: populated, conversation: populatedConv });
    } catch (err) {
      logger.error('Error sending button response:', err);
    }
  }
}

export const flowService = new FlowService();
