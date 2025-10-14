import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, User, ShieldAlert } from 'lucide-react';
import { useAdminDisputeMessaging } from '@/hooks/useAdminDisputeMessaging';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

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
  const [messageToSeller, setMessageToSeller] = useState('');
  const [messageToBuyer, setMessageToBuyer] = useState('');
  const { messagesToSeller, messagesToBuyer, isLoading, sendToSeller, sendToBuyer, isSendingToSeller, isSendingToBuyer } = useAdminDisputeMessaging({ disputeId, sellerId, buyerId });
  const sellerMessagesRef = useRef<HTMLDivElement>(null);
  const buyerMessagesRef = useRef<HTMLDivElement>(null);

  const isResolved = status.startsWith('resolved');

  // Conversations privées strictes
  const sellerMessages = messagesToSeller;
  const buyerMessages = messagesToBuyer;

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom(sellerMessagesRef);
    scrollToBottom(buyerMessagesRef);
  }, [messagesToSeller, messagesToBuyer]);

  const sendMessage = async (
    recipientId: string,
    message: string,
    messageType: 'admin_to_seller' | 'admin_to_buyer',
    setMessage: (val: string) => void
  ) => {
    if (!message.trim() || !user || !recipientId) {
      toast.error("Impossible d'envoyer le message - destinataire invalide");
      return;
    }

    try {
      if (messageType === 'admin_to_seller') {
        await sendToSeller({ message: message.trim() });
      } else {
        await sendToBuyer({ message: message.trim() });
      }

      setMessage('');
      
      // Créer une notification pour l'utilisateur destinataire
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.from('activity_logs').insert({
        user_id: recipientId,
        activity_type: 'dispute_admin_message',
        title: 'Nouveau message de l\'administration',
        description: 'L\'administration vous a envoyé un message concernant votre litige',
        metadata: {
          dispute_id: disputeId,
          sender_type: 'admin',
          message_preview: message.substring(0, 100),
        }
      });

      // Log pour l'admin
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        activity_type: 'dispute_admin_message',
        title: `Message envoyé au ${messageType === 'admin_to_seller' ? 'vendeur' : 'acheteur'}`,
        description: `Message admin envoyé dans le litige #${disputeId.substring(0, 8)}`,
        metadata: {
          dispute_id: disputeId,
          recipient_type: messageType === 'admin_to_seller' ? 'seller' : 'buyer',
          recipient_id: recipientId,
          message_preview: message.substring(0, 50),
        }
      });
    } catch (error) {
      logger.error('Error sending message:', error);
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
                const isAdmin = msg.message_type?.startsWith('admin_to_');
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
                onClick={() => sendMessage(sellerId, messageToSeller, 'admin_to_seller', setMessageToSeller)}
                disabled={!messageToSeller.trim() || isSendingToSeller}
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
                const isAdmin = msg.message_type?.startsWith('admin_to_');
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
                onClick={() => sendMessage(buyerId, messageToBuyer, 'admin_to_buyer', setMessageToBuyer)}
                disabled={!messageToBuyer.trim() || isSendingToBuyer}
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
