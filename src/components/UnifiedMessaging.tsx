import { useState, useRef, useEffect, useLayoutEffect, useMemo, memo } from 'react';
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
  inline?: boolean; // If true, render without Dialog wrapper (for nested dialogs)
}

const UnifiedMessagingComponent = ({ 
  conversationId,
  open, 
  onOpenChange,
  otherParticipantName,
  title,
  disputeId,
  inline = false
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
  const atBottomRef = useRef(true);

  // Layout refs to compute available height for the scroll area (iOS keyboard friendly)
  const contentRootRef = useRef<HTMLDivElement>(null);
  const headerMeasureRef = useRef<HTMLDivElement>(null);
  const footerMeasureRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>(0);
 
  const { messages, isLoading, sendMessage, isSendingMessage } = useConversation(conversationId);
  
  const { 
    proposals, 
    acceptProposal, 
    rejectProposal, 
    isAccepting, 
    isRejecting 
  } = useDisputeProposals(disputeId || '');

  // DEBUG: Log proposals data
  useEffect(() => {
    if (disputeId && proposals.length > 0) {
      logger.debug('UnifiedMessaging - Proposals loaded', {
        count: proposals.length,
        proposals: proposals.map((p: any) => ({
          id: p.id,
          proposer_id: p.proposer_id,
          status: p.status,
          proposal_type: p.proposal_type,
          created_at: p.created_at
        })),
        currentUserId: user?.id
      });
    }
  }, [disputeId, proposals, user?.id]);

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

  // Auto mark as read only if user is viewing bottom and tab is visible
  useEffect(() => {
    if (open && conversationId && messages.length > 0 && document.visibilityState === 'visible' && atBottomRef.current) {
      const timer = setTimeout(() => {
        markAsRead(conversationId);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, conversationId, messages.length, markAsRead]);

  const ensureBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Track if user is at bottom to decide auto-read
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
      atBottomRef.current = atBottom;
    };
    onScroll();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

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

  // Recompute the exact scrollable height on mobile (iOS keyboard friendly)
  useLayoutEffect(() => {
    const recompute = () => {
      const root = contentRootRef.current;
      const header = headerMeasureRef.current;
      const footer = footerMeasureRef.current;
      if (!root || !header || !footer) return;
      const available = root.clientHeight;
      const h = available - header.offsetHeight - footer.offsetHeight;
      setListHeight(Math.max(100, h));
    };

    recompute();
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    window.addEventListener('resize', recompute);
    vv?.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('resize', recompute);
      vv?.removeEventListener('resize', recompute);
    };
  }, [open, keyboardInset]);

  useEffect(() => {
    if (open && atBottomRef.current) ensureBottom();
  }, [listHeight]);

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

  // Map messages to proposals robustly (metadata, time proximity, and content parsing)
  const messageToProposal = useMemo(() => {
    const map = new Map<string, any>();
    if (!disputeId || !proposals || proposals.length === 0 || messages.length === 0) return map;

    const parseFromText = (text: string) => {
      const lower = text.toLowerCase();
      let proposal_type: 'partial_refund' | 'full_refund' | 'no_refund' | null = null;
      let refund_percentage: number | null = null;

      if (lower.includes('intégral') || lower.includes('100%')) proposal_type = 'full_refund';
      else if (lower.includes('aucun remboursement') || lower.includes('pas de remboursement')) proposal_type = 'no_refund';
      else if (lower.includes('remboursement')) proposal_type = 'partial_refund';

      const pctMatch = text.match(/(\d{1,3})%/);
      if (pctMatch) refund_percentage = Math.min(100, Math.max(0, parseInt(pctMatch[1])));
      return { proposal_type, refund_percentage };
    };

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

      // 2) Only consider system proposal messages
      const isSystemProposalText = message.message_type === 'system' &&
        message.message.includes('Proposition officielle');
      if (!isSystemProposalText) return;

      const messageTime = new Date(message.created_at).getTime();
      const { proposal_type, refund_percentage } = parseFromText(message.message);

      // 3) Wide time window match (5 minutes)
      const WIDE_WINDOW_MS = 5 * 60 * 1000;
      let best: any | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (const p of proposals as any[]) {
        // must be pending to act upon
        if (p.status !== 'pending') continue;
        const pTime = new Date(p.created_at).getTime();
        const timeDiff = Math.abs(pTime - messageTime);
        if (timeDiff > WIDE_WINDOW_MS) continue;

        // extra scoring by type/percentage if available
        let score = timeDiff;
        if (proposal_type && p.proposal_type === proposal_type) score *= 0.5;
        if (typeof refund_percentage === 'number' && typeof p.refund_percentage === 'number') {
          if (Math.abs(p.refund_percentage - refund_percentage) <= 5) score *= 0.5; // fuzzy match
        }
        if (score < bestDiff) {
          best = p;
          bestDiff = score;
        }
      }

      // 4) Fallback: most recent pending by other participant before message time
      if (!best) {
        best = (proposals as any[])
          .filter(p => p.status === 'pending' && p.proposer_id !== user?.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .find(p => new Date(p.created_at).getTime() <= messageTime);
      }

      if (best) {
        map.set(message.id, best);
      }
    });

    return map;
  }, [disputeId, proposals, messages, user?.id]);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const result = await acceptProposal(proposalId);
      if (!result?.partial) {
        toast.success('Proposition acceptée avec succès');
      }
    } catch (error: any) {
      logger.error('Error accepting proposal:', error);
      const message = error?.message || error?.error || 'Erreur lors de l\'acceptation de la proposition';
      toast.error('Erreur lors de l\'acceptation de la proposition', {
        description: message,
      });
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await rejectProposal(proposalId);
      toast.success('Proposition refusée');
    } catch (error: any) {
      logger.error('Error rejecting proposal:', error);
      const message = error?.message || error?.error || 'Erreur lors du rejet de la proposition';
      toast.error('Erreur lors du rejet de la proposition', {
        description: message,
      });
      toast.error('Erreur lors du rejet de la proposition');
    }
  };

  const messagingContent = (
    <div ref={contentRootRef} className="flex flex-col h-full">
      <div ref={headerMeasureRef}>
        <DialogHeader className="bg-background p-4 border-b shrink-0 relative">
          <DialogTitle className="pr-10">
          {title || (otherParticipantName 
            ? `${t('conversation.with', 'Conversation avec')} ${otherParticipantName}`
            : t('conversation.title', 'Messagerie')
          )}
        </DialogTitle>
        {!inline && (
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
        )}
      </DialogHeader>
      </div>

      <div 
        ref={messagesContainerRef}
        className="overflow-y-auto overflow-x-hidden p-4 bg-background"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          touchAction: 'pan-y',
          height: listHeight ? `${listHeight}px` : undefined,
          paddingBottom: isMobile ? Math.max(0, keyboardInset - 8) : 0,
          pointerEvents: 'auto'
        }}
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
                        : 'bg-card border'
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
                    
                    {isProposal && proposalData && (() => {
                      const shouldShowButtons = proposalData.status === 'pending' && proposalData.proposer_id !== user?.id;
                      logger.debug('Checking proposal button visibility', {
                        messageId: message.id,
                        proposalId: proposalData.id,
                        status: proposalData.status,
                        proposer_id: proposalData.proposer_id,
                        current_user_id: user?.id,
                        shouldShowButtons
                      });
                      return shouldShowButtons;
                    })() && (
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

      <div 
        ref={footerMeasureRef}
        className="border-t p-3 shrink-0 bg-background" 
        style={isMobile ? { 
          position: 'sticky',
          bottom: 0,
          transform: keyboardInset ? `translateY(-${keyboardInset}px)` : undefined,
          willChange: 'transform',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          flexShrink: 0 
        } : undefined}
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
    </div>
  );

  if (inline) {
    return messagingContent;
  }

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
            height: `calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
            maxHeight: `calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`,
            top: 'env(safe-area-inset-top, 0px)',
            overscrollBehavior: 'contain',
            paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
          } : {
            height: '85vh',
            maxHeight: '85vh'
          })
        }}
      >
        {messagingContent}
      </DialogContent>
    </Dialog>
  );
};

export const UnifiedMessaging = memo(UnifiedMessagingComponent);
