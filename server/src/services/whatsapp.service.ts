import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const BASE_URL = `https://graph.facebook.com/${env.WA_API_VERSION}/${env.WA_PHONE_NUMBER_ID}`;

class WhatsAppService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ──── TEXT ────
  async sendText(to: string, body: string, previewUrl = false, replyToMessageId?: string) {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: previewUrl, body },
    };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.send(payload);
  }

  // ──── IMAGE ────
  async sendImage(to: string, imageIdOrUrl: string, caption?: string, replyToMessageId?: string) {
    const image: Record<string, string> = {};
    if (imageIdOrUrl.startsWith('http')) {
      image.link = imageIdOrUrl;
    } else {
      image.id = imageIdOrUrl;
    }
    if (caption) image.caption = caption;
    const payload: Record<string, unknown> = { messaging_product: 'whatsapp', to, type: 'image', image };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.send(payload);
  }

  // ──── DOCUMENT ────
  async sendDocument(to: string, docIdOrUrl: string, filename: string, caption?: string, replyToMessageId?: string) {
    const document: Record<string, string> = { filename };
    if (docIdOrUrl.startsWith('http')) {
      document.link = docIdOrUrl;
    } else {
      document.id = docIdOrUrl;
    }
    if (caption) document.caption = caption;
    const payload: Record<string, unknown> = { messaging_product: 'whatsapp', to, type: 'document', document };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.send(payload);
  }

  // ──── VIDEO ────
  async sendVideo(to: string, videoIdOrUrl: string, caption?: string, replyToMessageId?: string) {
    const video: Record<string, string> = {};
    if (videoIdOrUrl.startsWith('http')) {
      video.link = videoIdOrUrl;
    } else {
      video.id = videoIdOrUrl;
    }
    if (caption) video.caption = caption;
    const payload: Record<string, unknown> = { messaging_product: 'whatsapp', to, type: 'video', video };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.send(payload);
  }

  // ──── AUDIO ────
  async sendAudio(to: string, audioIdOrUrl: string, replyToMessageId?: string) {
    const audio: Record<string, string> = {};
    if (audioIdOrUrl.startsWith('http')) {
      audio.link = audioIdOrUrl;
    } else {
      audio.id = audioIdOrUrl;
    }
    const payload: Record<string, unknown> = { messaging_product: 'whatsapp', to, type: 'audio', audio };
    if (replyToMessageId) payload.context = { message_id: replyToMessageId };
    return this.send(payload);
  }

  // ──── LOCATION ────
  async sendLocation(to: string, latitude: number, longitude: number, name?: string, address?: string) {
    return this.send({
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location: { latitude, longitude, name, address },
    });
  }

  // ──── INTERACTIVE: REPLY BUTTONS (max 3) ────
  async sendButtons(
    to: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    headerText?: string,
    footerText?: string
  ) {
    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    };
    if (headerText) interactive.header = { type: 'text', text: headerText };
    if (footerText) interactive.footer = { text: footerText };
    return this.send({ messaging_product: 'whatsapp', to, type: 'interactive', interactive });
  }

  // ──── INTERACTIVE: LIST MESSAGE (max 10 rows) ────
  async sendList(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string
  ) {
    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: bodyText },
      action: { button: buttonText, sections },
    };
    if (headerText) interactive.header = { type: 'text', text: headerText };
    if (footerText) interactive.footer = { text: footerText };
    return this.send({ messaging_product: 'whatsapp', to, type: 'interactive', interactive });
  }

  // ──── TEMPLATE ────
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: Array<Record<string, unknown>>
  ) {
    const template: Record<string, unknown> = {
      name: templateName,
      language: { code: languageCode },
    };
    if (components) template.components = components;
    return this.send({ messaging_product: 'whatsapp', to, type: 'template', template });
  }

  // ──── REACTION ────
  async sendReaction(to: string, messageId: string, emoji: string) {
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    });
  }

  // ──── MEDIA UPLOAD ────
  async uploadMedia(fileBuffer: Buffer, mimeType: string, filename: string) {
    const form = new FormData();
    form.append('file', fileBuffer, { filename, contentType: mimeType });
    form.append('type', mimeType);
    form.append('messaging_product', 'whatsapp');
    const response = await this.client.post('/media', form, {
      headers: { ...form.getHeaders() },
    });
    return response.data as { id: string };
  }

  // ──── MEDIA DOWNLOAD ────
  async getMediaUrl(mediaId: string): Promise<string> {
    const metaUrl = `https://graph.facebook.com/${env.WA_API_VERSION}/${mediaId}`;
    const response = await axios.get(metaUrl, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
    });
    return response.data.url;
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const response = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
      responseType: 'arraybuffer',
    });
    return Buffer.from(response.data);
  }

  // ──── MARK AS READ ────
  async markAsRead(messageId: string) {
    return this.send({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  // ──── GET TEMPLATES ────
  async getTemplates() {
    const url = `https://graph.facebook.com/${env.WA_API_VERSION}/${env.WA_BUSINESS_ACCOUNT_ID}/message_templates`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
    });
    return response.data;
  }

  async createTemplate(template: {
    name: string;
    language: string;
    category: string;
    components: Array<Record<string, unknown>>;
  }) {
    const url = `https://graph.facebook.com/${env.WA_API_VERSION}/${env.WA_BUSINESS_ACCOUNT_ID}/message_templates`;
    const response = await axios.post(url, template, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
    });
    return response.data;
  }

  async editTemplate(templateId: string, components: Array<Record<string, unknown>>) {
    const url = `https://graph.facebook.com/${env.WA_API_VERSION}/${templateId}`;
    const response = await axios.post(url, { components }, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
    });
    return response.data;
  }

  async deleteTemplate(templateName: string) {
    const url = `https://graph.facebook.com/${env.WA_API_VERSION}/${env.WA_BUSINESS_ACCOUNT_ID}/message_templates`;
    const response = await axios.delete(url, {
      headers: { Authorization: `Bearer ${env.WA_ACCESS_TOKEN}` },
      params: { name: templateName },
    });
    return response.data;
  }

  // ──── CORE SEND ────
  private async send(payload: Record<string, unknown>) {
    try {
      const response = await this.client.post('/messages', payload);
      return {
        success: true as const,
        messageId: response.data.messages?.[0]?.id as string | undefined,
        data: response.data,
      };
    } catch (error: any) {
      const errData = error.response?.data?.error;
      logger.error('WhatsApp API error:', errData || error.message);
      return {
        success: false as const,
        error: errData?.message || error.message,
        errorCode: errData?.code,
        details: errData,
      };
    }
  }
}

export const whatsappService = new WhatsAppService();
