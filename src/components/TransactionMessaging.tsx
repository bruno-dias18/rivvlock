import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedMessaging } from './UnifiedMessaging';

interface TransactionMessagingProps {
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherParticipantName?: string;
}

export const TransactionMessaging = ({ 
  transactionId, 
  open, 
  onOpenChange,
  otherParticipantName
}: TransactionMessagingProps) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // Fetch conversation_id from transaction
  useEffect(() => {
    const fetchConversation = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('conversation_id')
        .eq('id', transactionId)
        .single();
      
      setConversationId(data?.conversation_id || null);
      setIsLoadingConversation(false);
    };
    
    fetchConversation();
  }, [transactionId]);

  // Use unified messaging if conversation exists
  if (!isLoadingConversation && conversationId) {
    return (
      <UnifiedMessaging
        conversationId={conversationId}
        open={open}
        onOpenChange={onOpenChange}
        otherParticipantName={otherParticipantName}
        title={otherParticipantName ? `Conversation avec ${otherParticipantName}` : 'Messagerie'}
      />
    );
  }

  // Loading state
  if (isLoadingConversation) {
    return null;
  }

  // No conversation found (shouldn't happen for new transactions)
  return null;
};
