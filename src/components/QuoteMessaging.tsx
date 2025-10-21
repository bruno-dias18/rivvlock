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

  // ✅ OPTIMISATION: Fetch or create conversation
  useEffect(() => {
    const fetchOrCreateConversation = async () => {
      // D'abord essayer de récupérer la conversation existante
      const { data: quoteData } = await supabase
        .from('quotes')
        .select('conversation_id')
        .eq('id', quoteId)
        .single();
      
      if (quoteData?.conversation_id) {
        setConversationId(quoteData.conversation_id);
        setIsLoadingConversation(false);
        return;
      }

      // Si pas de conversation et utilisateur connecté, la créer (avec auto-liaison si devis ouvert)
      if (user) {
        try {
          const { data, error } = await supabase.functions.invoke('get-or-create-quote-conversation', {
            body: { quoteId }
          });

          if (!error && data?.conversation_id) {
            setConversationId(data.conversation_id);
          } else if (error) {
            console.error('[QuoteMessaging] Error creating conversation:', error);
          }
        } catch (err) {
          console.error('[QuoteMessaging] Unexpected error:', err);
        }
      }

      setIsLoadingConversation(false);
    };
    
    fetchOrCreateConversation();
  }, [quoteId, user]);

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
