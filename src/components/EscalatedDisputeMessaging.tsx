import { useState, useRef, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEscalatedDisputeMessaging } from '@/hooks/useEscalatedDisputeMessaging';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { useIsMobile } from '@/lib/mobileUtils';

interface EscalatedDisputeMessagingProps {
  disputeId: string;
  transactionId: string;
  status: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EscalatedDisputeMessaging = ({ 
  disputeId, 
  transactionId,
  status,
  open,
  onOpenChange
}: EscalatedDisputeMessagingProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInsets();

  const { 
    messages, 
    isLoading, 
    isSeller,
    isRoleReady,
    sendMessage, 
    isSending 
  } = useEscalatedDisputeMessaging({ disputeId, transactionId });

  const ensureBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  };

  useLayoutEffect(() => {
    if (open && messages.length > 0) {
      ensureBottom();
    }
  }, [messages, open]);

  useLayoutEffect(() => {
    if (open) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 200);
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || newMessage.length > 500) return;

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      toast.success(t('Message envoyé à l\'administrateur'));
      ensureBottom();
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

  const getDialogHeight = () => {
    if (keyboardInset > 0) {
      return `calc(100vh - ${keyboardInset}px - env(safe-area-inset-top))`;
    }
    return isMobile ? '100vh' : '85vh';
  };

  const isResolved = status === 'resolved' || status === 'resolved_refund' || status === 'resolved_release';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        style={{ height: getDialogHeight() }}
        className="flex flex-col gap-0 p-0 max-w-2xl"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {t('Communication privée avec l\'administration')}
          </DialogTitle>
          <Alert className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {isSeller 
                ? t('Vous communiquez en privé avec l\'administration. L\'acheteur ne voit pas ces messages.')
                : t('Vous communiquez en privé avec l\'administration. Le vendeur ne voit pas ces messages.')
              }
            </AlertDescription>
          </Alert>
        </DialogHeader>

        {/* Messages Area */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4 bg-muted/20 flex flex-col justify-end"
          style={{
            paddingBottom: isMobile ? 'max(1rem, env(safe-area-inset-bottom))' : '1rem',
          }}
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-3/4 self-start" />
              <Skeleton className="h-20 w-3/4 self-end" />
              <Skeleton className="h-20 w-3/4 self-start" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
              {t('Aucun message pour le moment')}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg: any) => {
                const isMyMessage = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
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
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {!isResolved && (
          <div 
            className="px-6 py-4 border-t bg-background shrink-0"
            style={{
              paddingBottom: isMobile 
                ? `max(1rem, calc(env(safe-area-inset-bottom) + ${keyboardInset > 0 ? '0.5rem' : '0px'}))`
                : '1rem',
            }}
          >
            <div className="flex gap-2 items-end">
              <div className="flex-1">
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
                  className="resize-none min-h-[80px]"
                  maxLength={500}
                  enterKeyHint="send"
                />
                <div className="flex justify-between items-center mt-1 px-1">
                  <span className={`text-xs ${newMessage.length > 450 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {newMessage.length}/500
                  </span>
                </div>
              </div>
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending || !isRoleReady || newMessage.length > 500}
                size="icon"
                className="h-10 w-10 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {isResolved && (
          <div className="px-6 py-4 border-t bg-background shrink-0">
            <Alert>
              <AlertDescription>
                {t('Ce litige est résolu. La messagerie est fermée.')}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
