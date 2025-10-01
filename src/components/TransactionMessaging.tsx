import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, X, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionMessages } from '@/hooks/useTransactionMessages';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/lib/mobileUtils';


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
  const isMobile = useIsMobile();
  
  const [newMessage, setNewMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const { messages, isLoading, sendMessage, isSendingMessage, markAsRead } = useTransactionMessages(transactionId);

  // Robust scroll to bottom using bottom anchor and retries
  const ensureBottom = (retryCount = 3) => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ block: 'end' });
    } else if (messagesContainerRef.current) {
      // Fallback
      const c = messagesContainerRef.current;
      c.scrollTop = c.scrollHeight;
    }
    if (retryCount > 0) {
      requestAnimationFrame(() => ensureBottom(retryCount - 1));
    }
  };

  // Auto-scroll on open and new messages
  useLayoutEffect(() => {
    if (open && messages.length > 0) {
      // Delay to ensure DOM is ready
      setTimeout(() => ensureBottom(), 300);
    }
  }, [open, messages.length]);

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
      // Force scroll after sending
      setTimeout(() => ensureBottom(), 50);
      setTimeout(() => ensureBottom(), 250);
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

  // Mobile: Use Sheet (bottom drawer) for better keyboard handling
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="bottom" 
          className="h-[100svh] max-h-[100svh] p-0 flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="p-4 border-b bg-background shrink-0">
            <SheetTitle className="flex items-center justify-between">
              <span>{t('transaction.messaging.title', 'Messagerie transaction')}</span>
              {otherParticipantName && (
                <span className="text-sm font-normal text-muted-foreground">
                  {t('transaction.messaging.with', 'Conversation avec')} {otherParticipantName}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          <div 
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-muted/20"
            style={{ touchAction: 'pan-y', paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">{t('transaction.messaging.loading', 'Chargement...')}</div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p>{t('transaction.messaging.noMessages', 'Aucun message pour le moment')}</p>
              </div>
            ) : (
              <div className="space-y-4 w-full">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex w-full ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border'
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {getSenderName(message.sender_id)} • {formatMessageTime(message.created_at)}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-all">{message.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div
            className="sticky bottom-0 left-0 right-0 bg-background border-t p-3"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('transaction.messaging.placeholder', 'Écrivez votre message...')}
                className="flex-1 h-14 resize-none"
                rows={2}
                maxLength={500}
                disabled={isSendingMessage}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSendingMessage}
                size="icon"
                className="h-14 w-14 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {newMessage.length}/500
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use Dialog (centered modal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{t('transaction.messaging.title', 'Messagerie transaction')}</span>
            {otherParticipantName && (
              <span className="text-sm font-normal text-muted-foreground">
                {t('transaction.messaging.with', 'Conversation avec')} {otherParticipantName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 space-y-4 min-h-[400px] max-h-[500px]"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">{t('transaction.messaging.loading', 'Chargement...')}</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>{t('transaction.messaging.noMessages', 'Aucun message pour le moment')}</p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex w-full ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[65%] rounded-lg p-3 ${
                      message.sender_id === user?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {getSenderName(message.sender_id)} • {formatMessageTime(message.created_at)}
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-all">{message.message}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t pt-4 px-4 pb-2">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('transaction.messaging.placeholder', 'Écrivez votre message...')}
              className="flex-1 min-h-[80px] resize-none"
              maxLength={500}
              disabled={isSendingMessage}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSendingMessage}
              size="icon"
              className="h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1 text-right">
            {newMessage.length}/500
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
