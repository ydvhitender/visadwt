import api from './axios';

export interface SendMessageParams {
  conversationId: string;
  type: string;
  text?: string;
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  buttons?: Array<{ id: string; title: string }>;
  headerText?: string;
  footerText?: string;
  listButtonText?: string;
  sections?: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: Array<Record<string, unknown>>;
}

export async function sendMessage(params: SendMessageParams) {
  const { data } = await api.post('/messages/send', params);
  return data;
}

export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as { mediaId: string; filename: string; mimeType: string };
}

export async function getTemplates() {
  const { data } = await api.get('/templates');
  return data;
}

export async function getUsers() {
  const { data } = await api.get('/users');
  return data;
}

export async function sendReaction(messageId: string, emoji: string) {
  const { data } = await api.post('/messages/react', { messageId, emoji });
  return data;
}

export async function getMediaUrl(mediaId: string) {
  const { data } = await api.get('/media/url', { params: { mediaId } });
  return data as { url: string };
}
