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
import { useDisputeProposals } from '@/hooks/useDisputeProposals';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/lib/mobileUtils';
import { CreateProposalDialog } from './CreateProposalDialog';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock as ClockIcon } from 'lucide-react';

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
  const isMobile = useIsMobile();
  const [newMessage, setNewMessage] = useState('');
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  
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

  // Filtrer les messages : afficher les messages publics (recipient_id null) 
  // ET les messages privés de l'admin destinés à l'utilisateur courant
  const displayMessages = messages.filter(
    (m) => m.recipient_id === null || m.recipient_id === user?.id
  );
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Auto-focus on textarea when component mounts (only on desktop)
  useEffect(() => {
    if (!isMobile) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [isMobile]);

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
  const isExpired = status === 'escalated' || status.startsWith('resolved');
  
  const pendingProposals = proposals.filter(p => p.status === 'pending');
  const canAcceptProposals = pendingProposals.some(p => p.proposer_id !== user?.id);

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      await acceptProposal(proposalId);
      toast.success('Proposition acceptée ! Le remboursement sera traité automatiquement.');
      // Demander un rafraîchissement (transactions + litiges) pour fermer la messagerie et mettre à jour les montants
      onProposalSent?.();
    } catch (error) {
      console.error('Error accepting proposal:', error);
      toast.error('Erreur lors de l\'acceptation de la proposition');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await rejectProposal(proposalId);
      toast.info('Proposition refusée');
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast.error('Erreur lors du refus de la proposition');
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="animate-pulse space-y-2 text-center">
          <div className="h-4 bg-muted rounded w-32 mx-auto"></div>
          <div className="h-20 bg-muted rounded w-48 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">{/* Changed to h-full to adapt to parent container */}
      {/* Header: Escalation Alert - Fixed at top */}
      {isExpired && (
        <div className="flex-shrink-0 border-b">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800">
            <div className="text-red-700 dark:text-red-300 text-sm font-medium">
              ⚠️ Ce litige a été escaladé au support client pour arbitrage
            </div>
          </div>
        </div>
      )}

      {/* Pending Proposals Section */}
      {pendingProposals.length > 0 && (
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

      {/* Messages - Scrollable center area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        {displayMessages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">Aucun message pour le moment</p>
              <p className="text-sm mt-1">Commencez la conversation pour résoudre ce litige</p>
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              const isAdminMessage = message.message_type === 'admin';
              
              return (
                <div
                  key={message.id}
                  className={`flex gap-3 animate-fade-in ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar className={`h-8 w-8 flex-shrink-0 ${isAdminMessage ? 'bg-purple-100 dark:bg-purple-900' : ''}`}>
                    <AvatarFallback className={`text-xs font-semibold ${isAdminMessage ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : ''}`}>
                      {isAdminMessage ? '👮' : isOwnMessage ? 'V' : 'A'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className={`flex flex-col gap-1 max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-muted-foreground px-1">
                      {isAdminMessage ? '🛡️ Admin RivvLock' : isOwnMessage ? 'Vous' : 'Autre partie'}
                    </span>
                    
                    <div
                      className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                        isAdminMessage
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 border border-purple-300 dark:border-purple-700'
                          : isOwnMessage
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
          {/* Official Proposal Button */}
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

          {/* Message Input */}
          <div className={`flex gap-2 items-end ${isMobile ? 'p-2' : 'p-3'}`}>
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isMobile ? "Votre message..." : "Tapez votre message... (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"}
              className={`resize-none ${isMobile ? 'min-h-[50px] max-h-[100px]' : 'min-h-[60px] max-h-[120px]'}`}
              disabled={isSendingMessage}
              aria-label="Message de négociation"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSendingMessage}
              size="icon"
              className={`flex-shrink-0 ${isMobile ? 'h-[50px] w-[50px]' : 'h-[60px] w-[60px]'}`}
              aria-label="Envoyer le message"
            >
              <Send className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
            </Button>
          </div>
        </div>
      )}

      {/* Expired State - No input */}
      {isExpired && (
        <div className="flex-shrink-0 border-t bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {status === 'escalated' 
              ? 'La messagerie est fermée. Le litige est en cours d\'arbitrage.'
              : status === 'resolved_agreement'
              ? '✅ Litige résolu par accord mutuel. La conversation est fermée.'
              : '✅ Litige résolu. La conversation est fermée.'
            }
          </p>
        </div>
      )}

      {/* Create Proposal Dialog */}
      <CreateProposalDialog
        open={showProposalDialog}
        onOpenChange={setShowProposalDialog}
        onCreateProposal={createProposal}
        isCreating={isCreating}
      />
    </Card>
  );
};