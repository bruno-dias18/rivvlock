import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, User, ShieldAlert } from 'lucide-react';
import { useDisputeMessages } from '@/hooks/useDisputeMessages';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

interface AdminDisputeMessagingProps {
  disputeId: string;
  sellerId: string;
  buyerId: string;
  sellerName: string;
  buyerName: string;
  status: string;
}

export const AdminDisputeMessaging = ({
  disputeId,
  sellerId,
  buyerId,
  sellerName,
  buyerName,
  status
}: AdminDisputeMessagingProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messageToSeller, setMessageToSeller] = useState('');
  const [messageToBuyer, setMessageToBuyer] = useState('');
  const { messages, isLoading } = useDisputeMessages(disputeId);
  const sellerMessagesRef = useRef<HTMLDivElement>(null);
  const buyerMessagesRef = useRef<HTMLDivElement>(null);

  const isResolved = status.startsWith('resolved');

  // Filtrer strictement: uniquement les messages entre l'admin et le vendeur
  const sellerMessages = (messages || []).filter(
    (msg) =>
      (msg.sender_id === sellerId && msg.recipient_id === user?.id) ||
      (msg.sender_id === user?.id && msg.recipient_id === sellerId)
  );

  // Filtrer strictement: uniquement les messages entre l'admin et l'acheteur
  const buyerMessages = (messages || []).filter(
    (msg) =>
      (msg.sender_id === buyerId && msg.recipient_id === user?.id) ||
      (msg.sender_id === user?.id && msg.recipient_id === buyerId)
  );

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom(sellerMessagesRef);
    scrollToBottom(buyerMessagesRef);
  }, [messages]);

  const sendMessage = async (recipientId: string, message: string, setMessage: (val: string) => void) => {
    if (!message.trim() || !user || !recipientId) {
      toast.error("Impossible d'envoyer le message - destinataire invalide");
      return;
    }

    try {
      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: disputeId,
          sender_id: user.id,
          recipient_id: recipientId,
          message: message.trim(),
          message_type: 'admin'
        });

      if (error) throw error;

      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
      
      toast.success("Message envoyé avec succès");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Impossible d'envoyer le message");
    }
  };

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Conversation avec le vendeur */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Conversation avec le vendeur
            <Badge variant="outline" className="ml-auto">{sellerName}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Messages avec le vendeur */}
          <div
            ref={sellerMessagesRef}
            className="max-h-[300px] overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg"
          >
            {sellerMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun message avec le vendeur
              </p>
            ) : (
              sellerMessages.map((msg) => {
                const isAdmin = msg.message_type === 'admin';
                const isFromSeller = msg.sender_id === sellerId;

                return (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      isAdmin
                        ? 'bg-purple-100 dark:bg-purple-950/30 ml-auto max-w-[85%]'
                        : 'bg-background border max-w-[85%]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isAdmin ? (
                        <ShieldAlert className="h-3 w-3 text-purple-600" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      <span className="text-xs font-medium">
                        {isAdmin ? 'Admin' : isFromSeller ? sellerName : 'Vous'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Input message pour le vendeur */}
          {!isResolved && (
            <div className="space-y-2">
              <Textarea
                value={messageToSeller}
                onChange={(e) => setMessageToSeller(e.target.value)}
                placeholder="Message privé au vendeur..."
                className="min-h-[80px]"
              />
              <Button
                onClick={() => sendMessage(sellerId, messageToSeller, setMessageToSeller)}
                disabled={!messageToSeller.trim()}
                className="w-full"
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer au vendeur
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation avec l'acheteur */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Conversation avec l'acheteur
            <Badge variant="outline" className="ml-auto">{buyerName}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Messages avec l'acheteur */}
          <div
            ref={buyerMessagesRef}
            className="max-h-[300px] overflow-y-auto space-y-2 p-3 bg-muted/30 rounded-lg"
          >
            {buyerMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun message avec l'acheteur
              </p>
            ) : (
              buyerMessages.map((msg) => {
                const isAdmin = msg.message_type === 'admin';
                const isFromBuyer = msg.sender_id === buyerId;

                return (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      isAdmin
                        ? 'bg-purple-100 dark:bg-purple-950/30 ml-auto max-w-[85%]'
                        : 'bg-background border max-w-[85%]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isAdmin ? (
                        <ShieldAlert className="h-3 w-3 text-purple-600" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      <span className="text-xs font-medium">
                        {isAdmin ? 'Admin' : isFromBuyer ? buyerName : 'Vous'}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(msg.created_at), 'dd/MM HH:mm', { locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Input message pour l'acheteur */}
          {!isResolved && (
            <div className="space-y-2">
              <Textarea
                value={messageToBuyer}
                onChange={(e) => setMessageToBuyer(e.target.value)}
                placeholder="Message privé à l'acheteur..."
                className="min-h-[80px]"
              />
              <Button
                onClick={() => sendMessage(buyerId, messageToBuyer, setMessageToBuyer)}
                disabled={!messageToBuyer.trim()}
                className="w-full"
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Envoyer à l'acheteur
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
