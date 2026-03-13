import api from './axios';
import type { Tag, Conversation } from '@/types';

export async function getTags() {
  const { data } = await api.get('/tags');
  return data as Tag[];
}

export async function createTag(body: { name: string; color: string }) {
  const { data } = await api.post('/tags', body);
  return data as Tag;
}

export async function deleteTag(id: string) {
  await api.delete(`/tags/${id}`);
}

export async function updateConversationTags(conversationId: string, add?: string[], remove?: string[]) {
  const { data } = await api.patch(`/tags/conversations/${conversationId}`, { add, remove });
  return data as Conversation;
}
