import api from './axios';

export interface MessageStats {
  total: number;
  inbound: number;
  outbound: number;
  daily: Array<{ date: string; inbound: number; outbound: number }>;
}

export interface ConversationStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface ResponseTimeStats {
  avgResponseTimeMs: number;
  avgResponseTimeMins: number;
  minResponseTimeMs: number;
  maxResponseTimeMs: number;
  totalResponses: number;
}

export interface AgentPerformance {
  agent: { _id: string; name: string; email: string; isOnline: boolean };
  messagesSent: number;
  activeConversations: number;
  resolvedConversations: number;
}

export async function getMessageStats(from?: string, to?: string) {
  const { data } = await api.get('/analytics/messages', { params: { from, to } });
  return data as MessageStats;
}

export async function getConversationStats() {
  const { data } = await api.get('/analytics/conversations');
  return data as ConversationStats;
}

export async function getResponseTimeStats(from?: string, to?: string) {
  const { data } = await api.get('/analytics/response-times', { params: { from, to } });
  return data as ResponseTimeStats;
}

export async function getAgentPerformance(from?: string, to?: string) {
  const { data } = await api.get('/analytics/agents', { params: { from, to } });
  return data as AgentPerformance[];
}
