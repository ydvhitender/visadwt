import api from './axios';
import type { Conversation, Message } from '@/types';

export async function getConversations(params?: {
  status?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
}) {
  const { data } = await api.get('/conversations', { params });
  return data as { conversations: Conversation[]; total: number };
}

export async function getConversation(id: string) {
  const { data } = await api.get(`/conversations/${id}`);
  return data as Conversation;
}

export async function createConversation(phoneNumber: string) {
  const { data } = await api.post('/conversations', { phoneNumber });
  return data as Conversation;
}

export async function getMessages(conversationId: string, page = 1) {
  const { data } = await api.get(`/conversations/${conversationId}/messages`, {
    params: { page, limit: 50 },
  });
  return data as { messages: Message[]; total: number };
}

export async function assignConversation(id: string, agentId: string | null) {
  const { data } = await api.patch(`/conversations/${id}/assign`, { agentId });
  return data as Conversation;
}

export async function updateConversationStatus(id: string, status: string) {
  const { data } = await api.patch(`/conversations/${id}/status`, { status });
  return data as Conversation;
}

export async function markConversationRead(id: string) {
  await api.patch(`/conversations/${id}/read`);
}

export async function deleteConversation(id: string) {
  await api.delete(`/conversations/${id}`);
}
