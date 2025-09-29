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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading, sendMessage, isSendingMessage } = useDisputeMessages(disputeId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await sendMessage({ message: newMessage.trim() });
      setNewMessage('');
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
      <div className="space-y-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-20 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Countdown Timer */}
      {timeRemaining && !isExpired && (
        <Card className="p-3 bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('dispute.timeRemaining', { 
                hours: timeRemaining.hours, 
                minutes: timeRemaining.minutes 
              })} pour résoudre à l'amiable
            </span>
          </div>
        </Card>
      )}

      {/* Escalated Notice */}
      {isExpired && (
        <Card className="p-3 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
          <div className="text-red-700 dark:text-red-300 text-sm font-medium">
            ⚠️ Ce litige a été escaladé au support client pour arbitrage
          </div>
        </Card>
      )}

      {/* Messages */}
      <Card className="p-4">
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Aucun message pour le moment</p>
              <p className="text-sm">Commencez la conversation pour résoudre ce litige</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className="h-8 w-8 mt-1">
                    <AvatarFallback className="text-xs">
                      {isOwnMessage ? 'Moi' : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex-1 max-w-xs ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {isOwnMessage ? 'Vous' : 'Utilisateur'}
                      </span>
                    </div>
                    
                    <div
                      className={`rounded-lg p-3 ${
                        isOwnMessage
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>
                    
                    <span className="text-xs text-muted-foreground mt-1">
                      {format(new Date(message.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* Message Input */}
      {!isExpired && (
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Tapez votre message pour négocier une solution..."
            className="min-h-[80px] resize-none"
            disabled={isSendingMessage}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSendingMessage}
            size="sm"
            className="shrink-0 h-20"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Quick Action Buttons */}
      {!isExpired && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewMessage('Je propose un remboursement de 50% pour compenser le problème.')}
          >
            💰 Remboursement partiel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewMessage('Je peux renvoyer le produit ou en envoyer un nouveau.')}
          >
            📦 Renvoi produit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNewMessage('Je propose un remboursement complet pour résoudre ce litige.')}
          >
            ↩️ Remboursement complet
          </Button>
        </div>
      )}
    </div>
  );
};