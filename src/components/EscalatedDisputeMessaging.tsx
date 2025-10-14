import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  onClose: () => void;
}

export const EscalatedDisputeMessaging = ({ 
  disputeId, 
  transactionId, 
  status,
  onClose
}: EscalatedDisputeMessagingProps) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const previousKeyboardInsetRef = useRef(0);
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInsets();

  // Browser detection (same as TransactionMessaging)
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isFirefoxiOS = /FxiOS/i.test(ua);
  const isChromeiOS = /CriOS/i.test(ua);
  const isBraveiOS = /Brave/i.test(ua);
  const isEdgiOS = /EdgiOS/i.test(ua);
  const isDuckiOS = /DuckDuckGo/i.test(ua);
  const isSafariiOS = isIOS && /Safari/i.test(ua) && !(isFirefoxiOS || isChromeiOS || isBraveiOS || isEdgiOS || isDuckiOS);

  const { 
    messages, 
    isLoading, 
    isSeller,
    isRoleReady,
    sendMessage, 
    isSending 
  } = useEscalatedDisputeMessaging({ disputeId, transactionId });

  const ensureBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Auto-scroll on new messages
  useLayoutEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => ensureBottom(), 300);
    }
  }, [messages.length]);

  // Auto-focus textarea when component mounts
  useLayoutEffect(() => {
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 200);
  }, []);

  // Auto-close on Safari keyboard dismiss
  useEffect(() => {
    const wasOpen = previousKeyboardInsetRef.current >= 40;
    const isClosedNow = keyboardInset === 0;
    
    if (wasOpen && isSafariiOS && isClosedNow) {
      setTimeout(() => onClose(), 150);
    }
    
    previousKeyboardInsetRef.current = keyboardInset;
  }, [keyboardInset, onClose, isSafariiOS]);

  // Tap-outside closer for non-Safari browsers
  useEffect(() => {
    if (isSafariiOS) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const sendBtn = sendButtonRef.current;

    const handler = (e: TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (textarea.contains(target) || (sendBtn && sendBtn.contains(target))) return;
      textarea.blur();
      setTimeout(() => onClose(), 120);
    };

    const onFocus = () => {
      document.addEventListener('touchstart', handler, true);
    };
    const onBlur = () => {
      document.removeEventListener('touchstart', handler, true);
    };

    textarea.addEventListener('focus', onFocus);
    textarea.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('touchstart', handler, true);
      textarea.removeEventListener('focus', onFocus);
      textarea.removeEventListener('blur', onBlur);
    };
  }, [onClose, isSafariiOS]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending || newMessage.length > 500) return;

    // Anti-spam: 2 seconds minimum between messages
    const now = Date.now();
    if (now - lastMessageTimeRef.current < 2000) {
      toast.error(t('Veuillez attendre un peu avant d\'envoyer un autre message'));
      return;
    }

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      lastMessageTimeRef.current = now;
      
      // Keep keyboard open with robust focus strategy (same as TransactionMessaging)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus({ preventScroll: true });
        });
      });
      
      // Show toast after focus to avoid interference
      setTimeout(() => {
        toast.success(t('Message envoyé à l\'administrateur'));
      }, 50);
      
      // Scroll after everything
      requestAnimationFrame(() => ensureBottom());
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

  const isResolved = status === 'resolved' || status === 'resolved_refund' || status === 'resolved_release';

  return (
    <>
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
          <div className="border-t p-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onFocus={() => setTimeout(ensureBottom, 100)}
                placeholder={
                  isRoleReady 
                    ? t('Écrivez votre message à l\'administration...')
                    : t('Initialisation du canal privé...')
                }
                disabled={!isRoleReady}
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
                disabled={!newMessage.trim() || isSending || !isRoleReady || newMessage.length > 500}
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
    </>
  );
};
