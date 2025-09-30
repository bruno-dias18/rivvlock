import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
// Avatar component inline since @/components/ui/avatar doesn't exist
const Avatar = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`}>
    {children}
  </div>
);

const AvatarFallback = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex h-full w-full items-center justify-center rounded-full bg-muted ${className}`}>
    {children}
  </div>
);
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useDisputeMessages } from '@/hooks/useDisputeMessages';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DisputeMessagingProps {
  disputeId: string;
  disputeDeadline?: string;
  status: string;
  onProposalSent?: () => void;
}

export const DisputeMessaging: React.FC<DisputeMessagingProps> = ({
  disputeId,
  disputeDeadline,
  status,
  onProposalSent,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  
  const { messages, isLoading, sendMessage, isSendingMessage } = useDisputeMessages(disputeId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-focus on textarea when component mounts (without scrolling)
  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  // Auto-scroll when new messages arrive (sent or received)
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      setTimeout(scrollToBottom, 100);
    }
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
      textareaRef.current?.focus({ preventScroll: true });
      onProposalSent?.();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickAction = (text: string) => {
    setNewMessage(text);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const getTimeRemaining = () => {
    if (!disputeDeadline) return null;
    
    const deadline = new Date(disputeDeadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  const timeRemaining = getTimeRemaining();
  const isExpired = status === 'escalated';

  if (isLoading) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="animate-pulse space-y-2 text-center">
          <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
          <div className="h-20 bg-muted rounded w-48 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[400px] flex flex-col overflow-hidden">
      {/* Header: Timer/Alerts - Fixed at top */}
      <div className="flex-shrink-0 border-b">
        {timeRemaining && !isExpired && (
          <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border-b border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('dispute.timeRemaining', { 
                  hours: timeRemaining.hours, 
                  minutes: timeRemaining.minutes 
                })}
              </span>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
            <div className="text-red-700 dark:text-red-300 text-sm font-medium">
              ⚠️ Ce litige a été escaladé au support client pour arbitrage
            </div>
          </div>
        )}
      </div>

      {/* Messages - Scrollable center area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">Aucun message pour le moment</p>
              <p className="text-sm mt-1">Commencez la conversation pour résoudre ce litige</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-fade-in ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs font-semibold">
                      {isOwnMessage ? 'V' : 'A'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col gap-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-muted-foreground px-1">
                      {isOwnMessage ? 'Vous' : 'Autre partie'}
                    </span>
                    
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card border rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                    </div>
                    
                    <span className="text-xs text-muted-foreground px-1">
                      {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
                );
              })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area - Fixed at bottom */}
      {!isExpired && (
        <div className="flex-shrink-0 border-t bg-background">
          {/* Quick Action Buttons */}
          <div className="p-2 border-b bg-muted/30">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => handleQuickAction('Je propose un remboursement de 50% pour compenser le problème.')}
              >
                💰 Remboursement partiel
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => handleQuickAction('Je peux renvoyer le produit ou en envoyer un nouveau.')}
              >
                📦 Renvoi produit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => handleQuickAction('Je propose un remboursement complet pour résoudre ce litige.')}
              >
                ↩️ Remboursement complet
              </Button>
            </div>
          </div>

          {/* Message Input */}
          <div className="p-3 flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Tapez votre message... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
              className="min-h-[60px] max-h-[120px] resize-none"
              disabled={isSendingMessage}
              aria-label="Message de négociation"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSendingMessage}
              size="icon"
              className="h-[60px] w-[60px] flex-shrink-0"
              aria-label="Envoyer le message"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Escalated State - No input */}
      {isExpired && (
        <div className="flex-shrink-0 border-t bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            La messagerie est fermée. Le litige est en cours d'arbitrage.
          </p>
        </div>
      )}
    </Card>
  );
};