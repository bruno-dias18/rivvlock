import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionMessages } from '@/hooks/useTransactionMessages';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const { messages, isLoading, sendMessage, isSendingMessage, markAsRead } = useTransactionMessages(transactionId);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  // Auto-focus textarea when opened and mark messages as read
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
    
    // Mark all messages as read when dialog opens
    if (open && messages.length > 0) {
      markAsRead().catch(err => {
        console.error('Error marking messages as read:', err);
      });
    }
  }, [open, messages.length, markAsRead]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSendingMessage) return;

    // Anti-spam: 2 seconds minimum between messages
    const now = Date.now();
    if (now - lastMessageTimeRef.current < 2000) {
      toast.error(t('errors.tooFast', 'Veuillez attendre un peu avant d\'envoyer un autre message'));
      return;
    }

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      lastMessageTimeRef.current = now;
      toast.success(t('messages.sent', 'Message envoyé'));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('errors.sendMessage', 'Erreur lors de l\'envoi du message'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'Pp', { locale: getDateLocale() });
  };

  const getSenderName = (senderId: string) => {
    if (senderId === user?.id) {
      return t('common.you', 'Vous');
    }
    return otherParticipantName || t('common.otherParticipant', 'Autre participant');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('transaction.messaging.title', 'Messagerie transaction')}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 rounded-lg">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-8">
                {t('common.loading', 'Chargement...')}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {t('transaction.messaging.noMessages', 'Aucun message. Commencez la conversation !')}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {getSenderName(msg.sender_id)}
                      </span>
                      <span className="text-xs opacity-70">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="pt-4 space-y-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.substring(0, 1000))}
              onKeyPress={handleKeyPress}
              placeholder={t('transaction.messaging.placeholder', 'Écrivez votre message...')}
              className="resize-none"
              rows={3}
              disabled={isSendingMessage}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {newMessage.length}/1000
              </span>
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSendingMessage}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {t('common.send', 'Envoyer')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
