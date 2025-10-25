import { useConversationBase } from './useConversationBase';

interface UnifiedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  message_type: 'text' | 'system' | 'proposal_update';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const useConversation = (conversationId: string | null | undefined) => {
  // Utilise le hook de base pour la logique commune
  const baseResult = useConversationBase(
    conversationId,
    ['conversation-messages', conversationId]
  );

  // Transforme les messages du format base vers le format attendu
  const messages: UnifiedMessage[] = baseResult.messages.map(msg => ({
    ...msg,
    message_type: msg.message_type as 'text' | 'system' | 'proposal_update',
    metadata: null,
  }));

  // Wrapper pour sendMessage avec validation de longueur
  const sendMessageWithValidation = async (params: { message: string }) => {
    const trimmedMessage = params.message.trim().slice(0, 1000);
    return baseResult.sendMessage(trimmedMessage);
  };

  return {
    messages,
    isLoading: baseResult.isLoading,
    sendMessage: sendMessageWithValidation,
    isSendingMessage: baseResult.isSendingMessage,
  };
};
