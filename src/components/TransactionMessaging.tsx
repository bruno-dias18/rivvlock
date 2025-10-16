import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedMessaging } from './UnifiedMessaging';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

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
  const { toast } = useToast();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [isEnsuringConversation, setIsEnsuringConversation] = useState(false);

  // Fetch conversation_id from transaction
  useEffect(() => {
    const fetchConversation = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('conversation_id')
        .eq('id', transactionId)
        .maybeSingle();
      
      setConversationId(data?.conversation_id || null);
      setIsLoadingConversation(false);
    };
    
    fetchConversation();
  }, [transactionId]);

  // Ensure conversation exists when opening
  useEffect(() => {
    const ensureConversation = async () => {
      if (!open || conversationId || isEnsuringConversation || isLoadingConversation) {
        return;
      }

      setIsEnsuringConversation(true);

      try {
        const { data, error } = await supabase.functions.invoke('ensure-transaction-conversation', {
          body: { transactionId }
        });

        if (error) throw error;

        if (data?.conversation_id) {
          setConversationId(data.conversation_id);
        } else {
          throw new Error('Pas de conversation_id retourné');
        }
      } catch (error) {
        console.error('Error ensuring conversation:', error);
        toast.error(error, {
          context: "Impossible d'ouvrir la messagerie. Vérifiez qu'un acheteur est assigné."
        });
        onOpenChange(false);
      } finally {
        setIsEnsuringConversation(false);
      }
    };

    ensureConversation();
  }, [open, conversationId, isEnsuringConversation, isLoadingConversation, transactionId, onOpenChange, toast]);

  // Show loading dialog while ensuring conversation
  if (open && (isLoadingConversation || isEnsuringConversation)) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Préparation de la messagerie...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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

  return null;
};
