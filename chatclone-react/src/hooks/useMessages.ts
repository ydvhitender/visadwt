import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMessages } from '@/api/conversations';
import type { Message, MessageReaction } from '@/types';

export const messagesKey = (conversationId: string) =>
  ['messages', conversationId] as const;

export function useMessages(conversationId: string | null, page = 1) {
  return useQuery({
    queryKey: messagesKey(conversationId!),
    queryFn: () => getMessages(conversationId!, page),
    enabled: !!conversationId,
  });
}

/**
 * Append a single message to the cache (used by socket + optimistic sends).
 */
export function useMessageUpdaters(conversationId: string | null) {
  const qc = useQueryClient();

  const appendMessage = (message: Message) => {
    if (!conversationId) return;
    qc.setQueryData<{ messages: Message[]; total: number }>(
      messagesKey(conversationId),
      (old) => {
        if (!old) return { messages: [message], total: 1 };
        // Prevent duplicates
        if (old.messages.some((m) => m._id === message._id)) return old;
        return { ...old, messages: [...old.messages, message], total: old.total + 1 };
      },
    );
  };

  const updateMessageStatus = (messageId: string, status: Message['status']) => {
    if (!conversationId) return;
    qc.setQueryData<{ messages: Message[]; total: number }>(
      messagesKey(conversationId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === messageId || m.waMessageId === messageId ? { ...m, status } : m,
          ),
        };
      },
    );
  };

  const updateMessageReactions = (messageId: string, reactions: MessageReaction[]) => {
    if (!conversationId) return;
    qc.setQueryData<{ messages: Message[]; total: number }>(
      messagesKey(conversationId),
      (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m._id === messageId ? { ...m, reactions } : m,
          ),
        };
      },
    );
  };

  const invalidateMessages = () => {
    if (!conversationId) return;
    qc.invalidateQueries({ queryKey: messagesKey(conversationId) });
  };

  return { appendMessage, updateMessageStatus, updateMessageReactions, invalidateMessages };
}
