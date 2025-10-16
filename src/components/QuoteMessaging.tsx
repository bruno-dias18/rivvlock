import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedMessaging } from './UnifiedMessaging';

interface QuoteMessagingProps {
  quoteId: string;
  token?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName?: string;
}

export const QuoteMessaging = ({ 
  quoteId, 
  token,
  open, 
  onOpenChange,
  clientName
}: QuoteMessagingProps) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // Fetch conversation_id from quote
  useEffect(() => {
    const fetchConversation = async () => {
      const { data } = await supabase
        .from('quotes')
        .select('conversation_id')
        .eq('id', quoteId)
        .single();
      
      setConversationId(data?.conversation_id || null);
      setIsLoadingConversation(false);
    };
    
    fetchConversation();
  }, [quoteId]);

  // Use unified messaging if conversation exists
  if (!isLoadingConversation && conversationId) {
    return (
      <UnifiedMessaging
        conversationId={conversationId}
        open={open}
        onOpenChange={onOpenChange}
        otherParticipantName={clientName}
        title={clientName ? `Devis pour ${clientName}` : 'Messagerie du devis'}
      />
    );
  }

  // Loading state
  if (isLoadingConversation) {
    return null;
  }

  // No conversation found (shouldn't happen for new quotes)
  return null;
};
