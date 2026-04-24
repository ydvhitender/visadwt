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
  replyToMessageId?: string;
}

export async function sendMessage(params: SendMessageParams) {
  const { data } = await api.post('/messages/send', params);
  return data;
}

export async function uploadMedia(file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/media/upload', formData, {
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
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

export async function deleteMessageForMe(messageId: string) {
  const { data } = await api.delete(`/messages/${messageId}`);
  return data;
}

export async function deleteMessageForEveryone(messageId: string) {
  const { data } = await api.delete(`/messages/${messageId}/everyone`);
  return data;
}

export async function togglePinMessage(messageId: string) {
  const { data } = await api.patch(`/messages/${messageId}/pin`);
  return data as { success: boolean; pinned: boolean };
}

export async function getMediaUrl(mediaId: string) {
  const { data } = await api.get('/media/url', { params: { mediaId } });
  return data as { url: string };
}
