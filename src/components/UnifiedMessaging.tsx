import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, X, CheckCircle, XCircle } from 'lucide-react';
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
import { useDisputeProposals } from '@/hooks/useDisputeProposals';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface UnifiedMessagingProps {
  conversationId: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherParticipantName?: string;
  title?: string;
  disputeId?: string;
}

export const UnifiedMessaging = ({ 
  conversationId,
  open, 
  onOpenChange,
  otherParticipantName,
  title,
  disputeId
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
  
  const { 
    proposals, 
    acceptProposal, 
    rejectProposal, 
    isAccepting, 
    isRejecting 
  } = useDisputeProposals(disputeId || '');

  // Marquer la conversation comme lue à l'ouverture
  useEffect(() => {
    if (open && conversationId) {
      markAsRead(conversationId);
    }
  }, [open, conversationId, markAsRead]);

  // Forcer un refetch instantané à l'ouverture pour éviter le cache vide
  const queryClient = useQueryClient();
  useEffect(() => {
    if (open && conversationId) {
      queryClient.refetchQueries({ queryKey: ['conversation-messages', conversationId], type: 'all' });
    }
  }, [open, conversationId, queryClient]);

  // Auto-marquer comme lu quand de nouveaux messages arrivent et la dialog est ouverte
  useEffect(() => {
    if (open && conversationId && messages.length > 0) {
      const timer = setTimeout(() => {
        markAsRead(conversationId);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [open, conversationId, messages.length, markAsRead]);

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

  // Map messages to their corresponding proposals using useMemo
  const messageToProposal = useMemo(() => {
    const map = new Map<string, any>();
    if (!disputeId || !proposals || proposals.length === 0 || messages.length === 0) return map;

    messages.forEach((message) => {
      // 1) Prefer explicit metadata link
      const proposalId = (message.metadata as any)?.proposal_id;
      if (proposalId) {
        const found = proposals.find((p: any) => p.id === proposalId);
        if (found) {
          map.set(message.id, found);
          return;
        }
      }

      // 2) Fallback: match on known system text within a tolerance window
      const isSystemProposalText = message.message_type === 'system' &&
        message.message.includes('Proposition officielle');
      if (!isSystemProposalText) return;

      const messageTime = new Date(message.created_at).getTime();
      const matchingProposal = proposals.find((p: any) => {
        const proposalTime = new Date(p.created_at).getTime();
        const timeDiff = Math.abs(proposalTime - messageTime);
        return timeDiff < 10000; // 10s tolerance
      });

      if (matchingProposal) {
        map.set(message.id, matchingProposal);
      }
    });

    return map;
  }, [disputeId, proposals, messages]);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await acceptProposal(proposalId);
      toast.success('Proposition acceptée avec succès');
    } catch (error) {
      logger.error('Error accepting proposal:', error);
      toast.error('Erreur lors de l\'acceptation de la proposition');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await rejectProposal(proposalId);
      toast.success('Proposition refusée');
    } catch (error) {
      logger.error('Error rejecting proposal:', error);
      toast.error('Erreur lors du rejet de la proposition');
    }
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
              {messages.map((message) => {
                const proposalData = messageToProposal.get(message.id);
                const isProposal = !!proposalData;

                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-3 ${
                        isProposal
                          ? 'bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700'
                          : message.sender_id === user?.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border'
                      }`}
                    >
                      {isProposal && (
                        <Badge className="mb-2 bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-700">
                          💰 Proposition officielle
                        </Badge>
                      )}
                      <div className="text-xs opacity-70 mb-1">
                        {getSenderName(message.sender_id)} • {formatMessageTime(message.created_at)}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-all">{message.message}</div>
                      
                      {isProposal && proposalData && proposalData.status === 'pending' && proposalData.proposer_id !== user?.id && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleAcceptProposal(proposalData.id)}
                            disabled={isAccepting || isRejecting}
                            className="flex-1"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Accepter
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectProposal(proposalData.id)}
                            disabled={isAccepting || isRejecting}
                            className="flex-1"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Refuser
                          </Button>
                        </div>
                      )}
                      
                      {isProposal && proposalData && proposalData.status !== 'pending' && (
                        <Badge 
                          className="mt-2" 
                          variant={proposalData.status === 'accepted' ? 'default' : 'destructive'}
                        >
                          {proposalData.status === 'accepted' ? '✓ Acceptée' : '✗ Refusée'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
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
