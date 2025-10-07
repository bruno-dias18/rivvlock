import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Clock, CheckCircle2, XCircle, Clock as ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useDisputeMessages } from '@/hooks/useDisputeMessages';
import { useDisputeProposals } from '@/hooks/useDisputeProposals';
import { format } from 'date-fns';
import { fr, enUS, de } from 'date-fns/locale';
import { useIsMobile } from '@/lib/mobileUtils';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { CreateProposalDialog } from './CreateProposalDialog';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { useUnreadDisputeAdminMessages } from '@/hooks/useUnreadDisputeAdminMessages';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';

// Avatar component inline
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

interface DisputeMessagingDialogProps {
  disputeId: string;
  disputeDeadline?: string;
  status: string;
  transactionAmount: number;
  currency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProposalSent?: () => void;
}

export const DisputeMessagingDialog: React.FC<DisputeMessagingDialogProps> = ({
  disputeId,
  disputeDeadline,
  status,
  transactionAmount,
  currency,
  open,
  onOpenChange,
  onProposalSent,
}) => {
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
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const previousKeyboardInsetRef = useRef(0);

  const { messages, isLoading, sendMessage, isSendingMessage } = useDisputeMessages(disputeId);
  const { 
    proposals, 
    createProposal, 
    acceptProposal, 
    rejectProposal,
    isCreating,
    isAccepting,
    isRejecting 
  } = useDisputeProposals(disputeId);
  const { markAsSeen, refetch: refetchDisputeUnread } = useUnreadDisputeAdminMessages(disputeId);
  const { markAsSeen: markGlobalAsSeen, refetch: refetchGlobalUnread } = useUnreadAdminMessages();

  // Filtrage des messages EXACTEMENT comme dans DisputeMessaging.tsx (lignes 71-86)
  const displayMessages = messages.filter(
    (m) => {
      const isMyMessage = m.sender_id === user?.id;
      const isToMe = m.recipient_id === user?.id;
      const isAdminMessage = m.message_type?.startsWith('admin');
      const isPublicMessage = !m.recipient_id && !isAdminMessage;
      const isSystemMessage = m.message_type === 'system' && !m.recipient_id;
      const isInitialMessage = m.message_type === 'initial' && !m.recipient_id;
      
      // Strict rule: hide all admin messages not explicitly addressed to current user
      if (isAdminMessage && m.recipient_id !== user?.id) {
        return false;
      }
      
      return isMyMessage || isToMe || isPublicMessage || isSystemMessage || isInitialMessage;
    }
  );

  const hasInitial = displayMessages.some((m) => m.message_type === 'initial');
  const [initialInfo, setInitialInfo] = useState<{ message: string; created_at: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      if (hasInitial || !disputeId) { setInitialInfo(null); return; }
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data } = await supabase
          .from('disputes')
          .select('reason, created_at')
          .eq('id', disputeId)
          .maybeSingle();
        if (!cancelled && data?.reason) {
          setInitialInfo({ message: data.reason, created_at: data.created_at });
        }
      } catch {}
    };
    loadInitial();
    return () => { cancelled = true; };
  }, [hasInitial, disputeId]);

  // Simple scroll to bottom
  const ensureBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Auto-scroll on open and new messages
  useLayoutEffect(() => {
    if (open && messages.length > 0) {
      setTimeout(() => ensureBottom(), 300);
    }
  }, [open, messages.length]);

  // Auto-focus textarea when opened (including mobile) + mark messages as seen
  useEffect(() => {
    if (open) {
      // Mark dispute messages as seen (specific dispute)
      const lastSeenKey = `last_seen_dispute_${disputeId}`;
      localStorage.setItem(lastSeenKey, new Date().toISOString());
      // Mark global disputes as seen (clears sidebar badge)
      localStorage.setItem('last_seen_disputes_global', new Date().toISOString());
      
      // Mark dispute messages as seen (old hook for admin messages)
      markAsSeen();
      // Mark admin messages as seen (global count)
      markGlobalAsSeen();
      
      // Force immediate refresh of unread counts
      setTimeout(() => {
        refetchDisputeUnread();
        refetchGlobalUnread();
      }, 100);
      
      if (textareaRef.current) {
        // Focus immédiat d'abord
        textareaRef.current.focus();
        
        // Puis re-focus avec délai pour assurer que ça fonctionne sur tous les mobiles
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 300);
      }
    }
  }, [open, disputeId, markAsSeen, markGlobalAsSeen, refetchDisputeUnread, refetchGlobalUnread]);

  // Close messaging when keyboard closes (Safari-only auto-close)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const wasOpen = previousKeyboardInsetRef.current >= 40;
    const isClosedNow = keyboardInset === 0;
    
    if (open && wasOpen && isSafariiOS && isClosedNow) {
      timeoutId = setTimeout(() => {
        onOpenChange(false);
      }, 150);
    }

    previousKeyboardInsetRef.current = keyboardInset;

    return () => clearTimeout(timeoutId);
  }, [keyboardInset, open, onOpenChange, isSafariiOS]);

  // Tap-outside closer for non-Safari browsers (iOS Brave/Chrome/Firefox and Android)
  useEffect(() => {
    if (!open) return;
    if (isSafariiOS) return; // Safari already handled by keyboardInset logic

    const textarea = textareaRef.current;
    if (!textarea) return;

    const sendBtn = sendButtonRef.current;

    const handler = (e: TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (textarea.contains(target) || (sendBtn && sendBtn.contains(target))) return;
      textarea.blur();
      setTimeout(() => onOpenChange(false), 120);
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
  }, [open, onOpenChange, isSafariiOS]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSendingMessage) return;

    // Anti-spam: 2 seconds minimum between messages
    const now = Date.now();
    if (now - lastMessageTimeRef.current < 2000) {
      toast.error('Veuillez attendre un peu avant d\'envoyer un autre message');
      return;
    }

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      // Déterminer la contrepartie comme destinataire explicite (RLS oblige)
      let recipientId: string | null = null;
      const { data: dispute } = await supabase
        .from('disputes')
        .select('transaction_id')
        .eq('id', disputeId)
        .single();
      if (dispute) {
        const { data: transaction } = await supabase
          .from('transactions')
          .select('id, user_id, buyer_id, title')
          .eq('id', dispute.transaction_id)
          .single();
        if (transaction) {
          recipientId = user?.id === transaction.user_id ? transaction.buyer_id : transaction.user_id;
        }
      }

      await sendMessage({ message: newMessage.trim(), recipientId });
      setNewMessage('');
      lastMessageTimeRef.current = now;
      
      // Keep keyboard open with robust focus strategy
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          textareaRef.current?.focus({ preventScroll: true });
        });
      });
      
      toast.success('Message envoyé');
      onProposalSent?.();
      
      // Scroll after everything
      requestAnimationFrame(() => ensureBottom());

      // Log activity for the other participant
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { data: dispute } = await supabase
          .from('disputes')
          .select('transaction_id')
          .eq('id', disputeId)
          .single();
        
        if (dispute) {
          const { data: transaction } = await supabase
            .from('transactions')
            .select('id, user_id, buyer_id, title')
            .eq('id', dispute.transaction_id)
            .single();
          
          if (transaction) {
            const recipientId = user?.id === transaction.user_id ? transaction.buyer_id : transaction.user_id;
            
            if (recipientId) {
              await supabase.from('activity_logs').insert({
                user_id: recipientId,
                activity_type: 'dispute_message_received',
                title: `Nouveau message dans le litige "${transaction.title}"`,
                description: 'Vous avez reçu un nouveau message',
                metadata: {
                  dispute_id: disputeId,
                  transaction_id: transaction.id
                }
              });
            }
          }
        }
      } catch (logError) {
        logger.error('Error logging activity:', logError);
      }
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
  const isDeadlinePassed = disputeDeadline && new Date(disputeDeadline) < new Date();
  const isExpired = status === 'escalated' 
    || status.startsWith('resolved')
    || (isDeadlinePassed && ['open', 'negotiating', 'responded'].includes(status));
  
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await acceptProposal(proposalId);
      toast.success('Proposition acceptée ! Le remboursement sera traité automatiquement.');
      onProposalSent?.();
    } catch (error) {
      logger.error('Error accepting proposal:', error);
      toast.error('Erreur lors de l\'acceptation de la proposition');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await rejectProposal(proposalId);
      toast.info('Proposition refusée');
    } catch (error) {
      logger.error('Error rejecting proposal:', error);
      toast.error('Erreur lors du refus de la proposition');
    }
  };

  // Calculate dynamic height based on keyboard
  const getDialogHeight = () => {
    if (!isMobile) return '85vh';

    const baseUnit = isSafariiOS ? '100vh' : '100dvh';

    if (keyboardInset > 0) {
      return `calc(${baseUnit} - ${keyboardInset}px - env(safe-area-inset-top, 0px))`;
    }
    return `calc(${baseUnit} - env(safe-area-inset-top, 0px))`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            // Defer focus to ensure content is mounted and visible (iOS Safari friendly)
            requestAnimationFrame(() => {
              textareaRef.current?.focus({ preventScroll: true });
              setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 300);
            });
          }}
          className="max-w-2xl w-[calc(100%-1rem)] p-0 flex flex-col gap-0 top-1 sm:top-1/2 translate-y-0 sm:translate-y-[-50%]"
          style={{ height: getDialogHeight() }}
        >
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Discussion du litige
            </DialogTitle>
          </DialogHeader>

          {/* Escalation Alert */}
          {isExpired && !status.startsWith('resolved') && (
            <div className="flex-shrink-0 border-b">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
                <div className="text-red-700 dark:text-red-300 text-sm font-medium">
                  ⚠️ Ce litige a été escaladé au support client pour arbitrage
                </div>
              </div>
            </div>
          )}

          {/* Pending Proposals Section */}
          {pendingProposals.length > 0 && !status.startsWith('resolved') && (
            <div className="flex-shrink-0 border-b bg-amber-50 dark:bg-amber-950/20">
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium text-sm">
                  <ClockIcon className="h-4 w-4" />
                  {pendingProposals.length === 1 ? 'Proposition en attente' : `${pendingProposals.length} propositions en attente`}
                </div>
                {pendingProposals.map((proposal) => {
                  const isOwnProposal = proposal.proposer_id === user?.id;
                  const proposalText = proposal.proposal_type === 'partial_refund'
                    ? `Remboursement de ${proposal.refund_percentage}%`
                    : proposal.proposal_type === 'full_refund'
                    ? 'Remboursement complet (100%)'
                    : 'Pas de remboursement';

                  return (
                    <div key={proposal.id} className="bg-white dark:bg-gray-900 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{proposalText}</div>
                          {proposal.message && (
                            <div className="text-xs text-muted-foreground mt-1">{proposal.message}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {isOwnProposal ? 'Votre proposition' : 'Proposition de l\'autre partie'} • {format(new Date(proposal.created_at), 'dd/MM à HH:mm', { locale: fr })}
                          </div>
                        </div>
                        {!isOwnProposal && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAcceptProposal(proposal.id)}
                              disabled={isAccepting || isRejecting}
                              className="h-7 px-2"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Accepter
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectProposal(proposal.id)}
                              disabled={isAccepting || isRejecting}
                              className="h-7 px-2"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Refuser
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 bg-muted/20 flex flex-col justify-end"
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Chargement...</div>
              </div>
            ) : displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
                <p className="font-medium">Aucun message pour le moment</p>
                <p className="text-sm mt-1">Commencez la conversation pour résoudre ce litige</p>
              </div>
            ) : (
              <div className="space-y-4">
                {initialInfo && (
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                          Raison du litige
                        </div>
                        <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">
                          {initialInfo.message}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
                      {format(new Date(initialInfo.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </div>
                  </div>
                )}
                {displayMessages.map((message) => {
                  const isOwnMessage = message.sender_id === user?.id;
                  const isAdminMessage = message.message_type?.startsWith('admin');
                  const isInitialMessage = message.message_type === 'initial';
                  
                  // Initial message has special styling
                  if (isInitialMessage) {
                    return (
                      <div key={message.id} className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-amber-600 dark:text-amber-400 text-lg">⚠️</span>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-1">
                              Raison du litige
                            </div>
                            <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">
                              {message.message}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
                          {format(new Date(message.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className={`h-8 w-8 flex-shrink-0 ${isAdminMessage ? 'bg-purple-100 dark:bg-purple-900' : ''}`}>
                        <AvatarFallback className={`text-xs font-semibold ${isAdminMessage ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : ''}`}>
                          {isAdminMessage ? '👮' : isOwnMessage ? 'V' : 'A'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col gap-1 max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-lg px-4 py-2.5 shadow-sm ${
                            isAdminMessage
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border border-purple-300 dark:border-purple-700'
                              : isOwnMessage
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-all">{message.message}</p>
                        </div>
                        
                        <span className="text-xs text-muted-foreground px-1">
                          {isAdminMessage ? '🛡️ Admin RivvLock' : isOwnMessage ? 'Vous' : 'Autre partie'} • {format(new Date(message.created_at), 'HH:mm', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          {!status.startsWith('resolved') && (
            <div className="border-t shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
              {/* Official Proposal Button - Only visible if not escalated */}
              {!isExpired && (
                <div className="p-2 border-b bg-primary/5">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowProposalDialog(true)}
                    disabled={isCreating}
                  >
                    📝 Faire une proposition officielle
                  </Button>
                </div>
              )}

              {/* Message Input */}
              {!isExpired ? (
                <div className="p-3">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      ref={textareaRef}
                      autoFocus
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      onFocus={() => setTimeout(ensureBottom, 100)}
                      onBlur={() => {
                        // Backup detection: if keyboard was open and textarea loses focus, close messaging
                        if (keyboardInset > 0 || previousKeyboardInsetRef.current > 0) {
                          setTimeout(() => {
                            if (document.activeElement !== textareaRef.current) {
                              onOpenChange(false);
                            }
                          }, 200);
                        }
                      }}
                      placeholder="Tapez votre message... (Entrée pour envoyer)"
                      className="flex-1 h-14 resize-none"
                      rows={2}
                      maxLength={300}
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
                    {newMessage.length}/300
                  </div>
                </div>
              ) : (
                // Escalated State - Admin communication only
                <div>
                  <div className="p-2 border-b bg-purple-50 dark:bg-purple-950/20">
                    <p className="text-xs text-purple-700 dark:text-purple-300 text-center">
                      🛡️ Communication avec l'admin uniquement
                    </p>
                  </div>
                  
                  <div className="p-3">
                    <div className="flex gap-2 items-end">
                      <Textarea
                        ref={textareaRef}
                        autoFocus
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onFocus={() => setTimeout(ensureBottom, 100)}
                        placeholder="Répondre à l'admin..."
                        className="flex-1 h-14 resize-none"
                        rows={2}
                        maxLength={300}
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
                      {newMessage.length}/300
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Proposal Dialog */}
      <CreateProposalDialog
        open={showProposalDialog}
        onOpenChange={setShowProposalDialog}
        onCreateProposal={async (data) => {
          await createProposal(data);
          setShowProposalDialog(false);
          onProposalSent?.();
        }}
        isCreating={isCreating}
        transactionAmount={transactionAmount}
        currency={currency}
      />
    </>
  );
};
