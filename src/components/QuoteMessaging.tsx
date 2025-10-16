import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuoteMessages } from '@/hooks/useQuoteMessages';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/lib/mobileUtils';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { logger } from '@/lib/logger';

interface QuoteMessagingProps {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName?: string;
}

export const QuoteMessaging = ({ 
  quoteId, 
  open, 
  onOpenChange,
  clientName 
}: QuoteMessagingProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInsets();
  
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafariiOS = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  
  const [newMessage, setNewMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);

  const { messages, isLoading, sendMessage, isSendingMessage } = useQuoteMessages(quoteId);

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
      textareaRef.current.focus();
    }
  }, [open]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSendingMessage) return;

    // Pour les utilisateurs non authentifiés, demander nom et email
    if (!user && (!senderName || !senderEmail)) {
      toast.error('Veuillez renseigner votre nom et email');
      return;
    }

    const now = Date.now();
    if (now - lastMessageTimeRef.current < 2000) {
      toast.error('Veuillez attendre un peu avant d\'envoyer un autre message');
      return;
    }

    try {
      await sendMessage({
        message: newMessage.trim(),
        senderEmail: user?.email || senderEmail,
        senderName: user ? `${user.email}` : senderName
      });
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
      toast.error('Erreur lors de l\'envoi du message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (date: string) => {
    return format(new Date(date), 'Pp', { locale: fr });
  };

  const getSenderName = (message: any) => {
    if (user && message.sender_id === user?.id) {
      return 'Vous';
    }
    return message.sender_name || 'Participant';
  };

  const getDialogHeight = () => {
    if (!isMobile) return '85vh';
    const baseUnit = isSafariiOS ? '100vh' : '100dvh';
    if (keyboardInset > 0) {
      return `calc(${baseUnit} - ${keyboardInset}px - env(safe-area-inset-top, 0px))`;
    }
    return `calc(${baseUnit} - env(safe-area-inset-top, 0px))`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl w-[calc(100%-1rem)] p-0 flex flex-col gap-0 top-1 sm:top-1/2 translate-y-0 sm:translate-y-[-50%]"
        style={{ height: getDialogHeight() }}
      >
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>
            {clientName 
              ? `Conversation avec ${clientName}`
              : 'Messagerie devis'
            }
          </DialogTitle>
        </DialogHeader>

        <div 
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-muted/20 flex flex-col justify-end"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Chargement...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
              <p>Aucun message pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOwnMessage = user ? message.sender_id === user?.id : message.sender_email === senderEmail;
                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border'
                      }`}
                    >
                      <div className="text-xs opacity-70 mb-1">
                        {getSenderName(message)} • {formatMessageTime(message.created_at)}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-all">{message.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
          {!user && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Votre nom"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-md"
              />
              <input
                type="email"
                placeholder="Votre email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-md"
              />
            </div>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setTimeout(ensureBottom, 100)}
              placeholder="Écrivez votre message..."
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