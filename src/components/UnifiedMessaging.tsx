import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageSquare, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation } from '@/hooks/useConversation';
import { useMarkConversationAsRead } from '@/hooks/useMarkConversationAsRead';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { useIsMobile } from '@/lib/mobileUtils';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { logger } from '@/lib/logger';

interface UnifiedMessagingProps {
  conversationId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherParticipantName?: string;
  title?: string;
}

export const UnifiedMessaging = ({ 
  conversationId,
  open, 
  onOpenChange,
  otherParticipantName,
  title
}: UnifiedMessagingProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInsets();
  const { markAsRead } = useMarkConversationAsRead();
  
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafariiOS = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  
  const [newMessage, setNewMessage] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const { messages, isLoading, sendMessage, isSendingMessage } = useConversation(conversationId);

  // Marquer la conversation comme lue à l'ouverture
  useEffect(() => {
    if (open && conversationId) {
      markAsRead(conversationId);
    }
  }, [open, conversationId, markAsRead]);

  const ensureBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  useLayoutEffect(() => {
    if (open && messages.length > 0) {
      setTimeout(() => ensureBottom(), 300);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSendingMessage) return;

    const now = Date.now();
    if (now - lastMessageTimeRef.current < 2000) {
      toast.error(t('errors.tooFast', 'Veuillez attendre un peu avant d\'envoyer un autre message'));
      return;
    }

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      lastMessageTimeRef.current = now;
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus({ preventScroll: true });
        });
      });
      
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


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-[calc(100%-1rem)] p-0 flex flex-col gap-0 
          top-0 left-2 right-2
          translate-x-0 translate-y-0
          sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:right-auto
          sm:translate-x-[-50%] sm:translate-y-[-50%]
          [&>button]:hidden"
        style={{
          ...(isMobile ? {
            height: `calc(100dvh - ${keyboardInset}px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
            maxHeight: `calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
            top: 'env(safe-area-inset-top, 0px)',
            overscrollBehavior: 'contain',
          } : {
            height: '85vh',
            maxHeight: '85vh'
          })
        }}
      >
        <DialogHeader className="bg-background p-4 border-b shrink-0 relative">
          <DialogTitle className="pr-10">
            {title || (otherParticipantName 
              ? `${t('conversation.with', 'Conversation avec')} ${otherParticipantName}`
              : t('conversation.title', 'Messagerie')
            )}
          </DialogTitle>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              aria-label={t('common.close', 'Fermer')}
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div 
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-muted/20"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">{t('common.loading', 'Chargement...')}</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>{t('conversation.noMessages', 'Aucun message pour le moment')}</p>
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

        <div className="border-t p-3 shrink-0 bg-background" 
          style={isMobile ? { paddingBottom: '12px' } : undefined}
        >
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setTimeout(ensureBottom, 100)}
              placeholder={t('conversation.placeholder', 'Écrivez votre message...')}
              className="flex-1 h-14 resize-none"
              rows={2}
              maxLength={500}
              enterKeyHint="send"
            />
            <Button
               ref={sendButtonRef}
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
