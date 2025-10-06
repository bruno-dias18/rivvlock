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
import { useIsMobile } from '@/lib/mobileUtils';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { logger } from '@/lib/logger';

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
  const keyboardInset = useKeyboardInsets();
  
  // Browser detection to tailor viewport units (iOS Safari vs others)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isFirefoxiOS = /FxiOS/i.test(ua);
  const isChromeiOS = /CriOS/i.test(ua);
  const isBraveiOS = /Brave/i.test(ua);
  const isEdgiOS = /EdgiOS/i.test(ua);
  const isDuckiOS = /DuckDuckGo/i.test(ua);
  const isSafariiOS = isIOS && /Safari/i.test(ua) && !(isFirefoxiOS || isChromeiOS || isBraveiOS || isEdgiOS || isDuckiOS);
  const [newMessage, setNewMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const { messages, isLoading, sendMessage, isSendingMessage, markAsRead } = useTransactionMessages(transactionId);

  // Simple scroll to bottom
  const ensureBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
        logger.error('Error marking messages as read:', err);
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
      
      // Keep keyboard open with robust focus strategy
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus({ preventScroll: true });
        });
      });
      
      // Show toast after focus to avoid interference
      setTimeout(() => {
        toast.success(t('messages.sent', 'Message envoyé'));
      }, 50);
      
      // Scroll after everything
      requestAnimationFrame(() => ensureBottom());
    } catch (error) {
      logger.error('Error sending message:', error);
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

  // Calculate dynamic height based on keyboard
  const getDialogHeight = () => {
    if (!isMobile) return '85vh';

    // Use 100vh on iOS Safari (was already correct before), 100dvh elsewhere (fixes Brave/Firefox)
    const baseUnit = isSafariiOS ? '100vh' : '100dvh';

    if (keyboardInset > 0) {
      return `calc(${baseUnit} - ${keyboardInset}px - env(safe-area-inset-top, 0px))`;
    }
    return `calc(${baseUnit} - env(safe-area-inset-top, 0px))`;
  };

  // Use Dialog for both mobile and desktop (stable, predictable)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-[calc(100%-1rem)] p-0 flex flex-col gap-0 top-1 sm:top-1/2 translate-y-0 sm:translate-y-[-50%]"
        style={{ height: getDialogHeight() }}
      >
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>
            {otherParticipantName 
              ? `${t('transaction.messaging.with', 'Conversation avec')} ${otherParticipantName}`
              : t('transaction.messaging.title', 'Messagerie transaction')
            }
          </DialogTitle>
        </DialogHeader>

        <div 
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-muted/20 flex flex-col justify-end"
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
            <div className="space-y-4">
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

        <div className="border-t p-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setTimeout(ensureBottom, 100)}
              placeholder={t('transaction.messaging.placeholder', 'Écrivez votre message...')}
              className="flex-1 h-14 resize-none"
              rows={2}
              maxLength={500}
              enterKeyHint="send"
            />
            <Button
              type="button"
              onClick={handleSendMessage}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
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
      </DialogContent>
    </Dialog>
  );
};
