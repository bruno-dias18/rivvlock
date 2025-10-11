import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEscalatedDisputeMessaging } from '@/hooks/useEscalatedDisputeMessaging';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface EscalatedDisputeMessagingProps {
  disputeId: string;
  transactionId: string;
  status: string;
}

export const EscalatedDisputeMessaging = ({ 
  disputeId, 
  transactionId,
  status 
}: EscalatedDisputeMessagingProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { 
    messages, 
    isLoading, 
    isSeller,
    isRoleReady,
    sendMessage, 
    isSending 
  } = useEscalatedDisputeMessaging({ disputeId, transactionId });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // DEBUG LOG (temporary - will remove after validation)
  useEffect(() => {
    console.log('[ESCALATED USER VIEW]', {
      messageCount: messages.length,
      isSeller,
      isRoleReady,
      disputeId
    });
  }, [messages.length, isSeller, isRoleReady, disputeId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      toast.success(t('Message envoyé à l\'administrateur'));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('Erreur lors de l\'envoi du message'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'fr': return fr;
      case 'de': return de;
      default: return enUS;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('Communication privée avec l\'administration')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isResolved = status === 'resolved' || status === 'resolved_refund' || status === 'resolved_release';

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('Communication privée avec l\'administration')}
        </CardTitle>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isSeller 
              ? t('Vous communiquez en privé avec l\'administration. L\'acheteur ne voit pas ces messages.')
              : t('Vous communiquez en privé avec l\'administration. Le vendeur ne voit pas ces messages.')
            }
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Messages Area */}
          <div className="h-[400px] overflow-y-auto border rounded-lg p-4 space-y-3 bg-muted/30">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {t('Aucun message pour le moment')}
              </div>
            ) : (
              messages.map((msg: any) => {
                const isMyMessage = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        isMyMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.message}
                      </p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                          locale: getDateLocale(),
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {!isResolved && (
            <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                isRoleReady 
                  ? t('Écrivez votre message à l\'administration...')
                  : t('Initialisation du canal privé...')
              }
              disabled={!isRoleReady}
              className="resize-none"
              rows={3}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending || !isRoleReady}
              size="icon"
              className="h-auto"
            >
              <Send className="h-4 w-4" />
            </Button>
            </div>
          )}

          {isResolved && (
            <Alert>
              <AlertDescription>
                {t('Ce litige est résolu. La messagerie est fermée.')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
