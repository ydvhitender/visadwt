import api from './axios';
import type { CannedResponse } from '@/types';

export async function getCannedResponses(search?: string) {
  const { data } = await api.get('/canned-responses', { params: search ? { search } : {} });
  return data as CannedResponse[];
}

export async function createCannedResponse(body: { title: string; shortcut: string; body: string; category?: string; isGlobal?: boolean }) {
  const { data } = await api.post('/canned-responses', body);
  return data as CannedResponse;
}

export async function updateCannedResponse(id: string, body: Partial<CannedResponse>) {
  const { data } = await api.put(`/canned-responses/${id}`, body);
  return data as CannedResponse;
}

export async function deleteCannedResponse(id: string) {
  await api.delete(`/canned-responses/${id}`);
}
