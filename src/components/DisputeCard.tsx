import React, { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Scale } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { UnifiedMessaging } from './UnifiedMessaging';
import { EscalatedDisputeMessaging } from './EscalatedDisputeMessaging';
import { useIsMobile } from '@/lib/mobileUtils';
import { useDisputeProposals } from '@/hooks/useDisputeProposals';
import { AdminOfficialProposalCard } from './AdminOfficialProposalCard';
import { CreateProposalDialog } from './CreateProposalDialog';
import { logger } from '@/lib/logger';
import { useUnreadConversationMessages } from '@/hooks/useUnreadConversationMessages';
import { useUnreadDisputeAdminMessages } from '@/hooks/useUnreadDisputeAdminMessages';
import { useMarkConversationAsRead } from '@/hooks/useMarkConversationAsRead';
import { DisputeHeader } from './DisputeCard/DisputeHeader';
import { DisputeContent } from './DisputeCard/DisputeContent';
import { DisputeResolution } from './DisputeCard/DisputeResolution';
import type { Dispute, Transaction } from '@/types';

interface DisputeCardProps {
  dispute: Dispute & { transactions?: Transaction };
  onRefetch?: () => void;
}

const DisputeCardComponent: React.FC<DisputeCardProps> = ({ dispute, onRefetch }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [showMessaging, setShowMessaging] = useState(false);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(!isMobile);
  const [isDisputeMessageExpanded, setIsDisputeMessageExpanded] = useState(!isMobile);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showProposalDialog, setShowProposalDialog] = useState(false);

  const { proposals, createProposal, isCreating } = useDisputeProposals(dispute.id);
  const adminOfficialProposals = proposals?.filter(p => p.admin_created && p.requires_both_parties) || [];
  const { unreadCount: unreadMessages, refetch: refetchUnread } = useUnreadConversationMessages(dispute.conversation_id);
  const { unreadCount: unreadAdminMessages } = useUnreadDisputeAdminMessages(dispute.id, dispute);
  const { markAsRead } = useMarkConversationAsRead();

  const transaction = dispute.transactions;
  if (!transaction) return null;

  const getUserRole = (): 'seller' | 'buyer' | 'reporter' => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return 'reporter';
  };

  const userRole = getUserRole();

  const parseResolution = () => {
    if (!dispute.resolution) return null;
    
    const percentMatch = dispute.resolution.match(/(\d+)%/);
    const refundPercentage = percentMatch ? parseInt(percentMatch[1]) : 0;
    
    let proposalType = 'no_refund';
    if (dispute.resolution.includes('full_refund') || refundPercentage === 100) {
      proposalType = 'full_refund';
    } else if (dispute.resolution.includes('partial_refund') && refundPercentage > 0) {
      proposalType = 'partial_refund';
    }
    
    const totalAmount = transaction.price;
    const currency = transaction.currency.toUpperCase();
    
    let buyerRefund = 0;
    let sellerReceived = 0;
    
    if (proposalType === 'full_refund') {
      buyerRefund = totalAmount;
      sellerReceived = 0;
    } else if (proposalType === 'partial_refund') {
      const platformFee = totalAmount * 0.05;
      const netAmount = totalAmount - platformFee;
      
      buyerRefund = netAmount * (refundPercentage / 100);
      sellerReceived = netAmount * ((100 - refundPercentage) / 100);
    } else {
      const platformFee = totalAmount * 0.05;
      buyerRefund = 0;
      sellerReceived = totalAmount - platformFee;
    }
    
    return {
      proposalType,
      refundPercentage,
      buyerRefund: buyerRefund.toFixed(2),
      sellerReceived: sellerReceived.toFixed(2),
      currency
    };
  };

  const resolutionDetails = parseResolution();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'negotiating':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'responded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'escalated':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'resolved_refund':
      case 'resolved_release':
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Ouvert';
      case 'negotiating':
        return 'En négociation';
      case 'responded':
        return 'Vendeur a répondu';
      case 'escalated':
        return 'Escaladé au support';
      case 'resolved_refund':
        return 'Résolu - Remboursement';
      case 'resolved_release':
        return 'Résolu - Fonds libérés';
      case 'resolved':
        return 'Résolu';
      default:
        return status;
    }
  };

  const getDisputeTypeText = (type: string) => {
    switch (type) {
      case 'quality_issue':
        return 'Problème de qualité';
      case 'not_as_described':
        return 'Non conforme à la description';
      case 'damaged_item':
        return 'Article endommagé';
      case 'not_received':
        return 'Article non reçu';
      case 'other':
        return 'Autre';
      default:
        return type;
    }
  };

  const getTimeRemaining = () => {
    if (!dispute.dispute_deadline || dispute.status === 'escalated') return null;
    
    const deadline = new Date(dispute.dispute_deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  const timeRemaining = getTimeRemaining();
  const isDeadlinePassed = dispute.dispute_deadline && new Date(dispute.dispute_deadline) < new Date();
  const isExpired = dispute.status === 'escalated' || (isDeadlinePassed && ['open', 'negotiating', 'responded'].includes(dispute.status));

  const handleDeleteDispute = async () => {
    if (!user?.id) {
      toast.error("Vous devez être connecté");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir archiver ce litige résolu ? Il restera visible pour l'autre partie et les administrateurs.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const isSeller = transaction?.user_id === user.id;
      const isBuyer = transaction?.buyer_id === user.id;
      
      if (!isSeller && !isBuyer) {
        toast.error("Vous n'êtes pas autorisé à archiver ce litige");
        return;
      }
      
      const updateData = isSeller 
        ? { 
            archived_by_seller: true, 
            seller_archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        : { 
            archived_by_buyer: true, 
            buyer_archived_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
      
      const { error } = await supabase
        .from('disputes')
        .update(updateData)
        .eq('id', dispute.id);

      if (error) throw error;

      toast.success("Litige archivé avec succès");
      onRefetch?.();
    } catch (error: any) {
      logger.error('Error archiving dispute:', error);
      toast.error("Erreur lors de l'archivage du litige");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-800 overflow-hidden">
      <CardHeader>
        <DisputeHeader
          disputeId={dispute.id}
          transactionTitle={dispute.transactions?.title}
          unreadMessages={unreadMessages}
          timeRemaining={timeRemaining}
          isExpired={isExpired}
          status={dispute.status}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        <DisputeContent
          transaction={transaction}
          dispute={dispute}
          isTransactionDetailsOpen={isTransactionDetailsOpen}
          setIsTransactionDetailsOpen={setIsTransactionDetailsOpen}
          isDisputeMessageExpanded={isDisputeMessageExpanded}
          setIsDisputeMessageExpanded={setIsDisputeMessageExpanded}
          getDisputeTypeText={getDisputeTypeText}
        />

        {/* Admin Official Proposals */}
        {adminOfficialProposals.length > 0 && !dispute.status.startsWith('resolved') && (
          <div className="space-y-3">
            {adminOfficialProposals.map((proposal) => (
              <AdminOfficialProposalCard
                key={proposal.id}
                proposal={proposal}
                transaction={transaction}
                onRefetch={onRefetch}
              />
            ))}
          </div>
        )}

        {/* Faire une proposition Button - Bloqué si escaladé */}
        {!dispute.status.startsWith('resolved') && 
         dispute.status !== 'escalated' &&
         !dispute.escalated_at &&
         ['open', 'responded', 'negotiating'].includes(dispute.status) && 
         (transaction.user_id === user?.id || transaction.buyer_id === user?.id) && (
          <div>
            <Button
              variant="default"
              className="w-full"
              onClick={() => setShowProposalDialog(true)}
            >
              <Scale className="h-4 w-4 mr-2" />
              Faire une proposition
            </Button>
          </div>
        )}
        
        {/* Message si escaladé */}
        {(dispute.status === 'escalated' || dispute.escalated_at) && !dispute.status.startsWith('resolved') && (
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              ⚠️ Ce litige a été escaladé au support RivvLock. Seule l'équipe administrative peut désormais faire des propositions de résolution.
            </p>
          </div>
        )}

        {/* Discussion Button */}
        {!dispute.status.startsWith('resolved') && ((dispute.status !== 'escalated' && dispute.conversation_id) || dispute.status === 'escalated') && (
          <div>
            <Button
              variant={(dispute.status === 'escalated' ? unreadAdminMessages : unreadMessages) > 0 ? "default" : "outline"}
              className="w-full relative"
              onClick={() => {
                setShowMessaging(true);
                if (dispute.status !== 'escalated' && dispute.conversation_id) {
                  markAsRead(dispute.conversation_id);
                  refetchUnread();
                }
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Voir la discussion
              {((dispute.status === 'escalated' ? unreadAdminMessages : unreadMessages) > 0) && (
                <Badge 
                  variant="destructive" 
                  className="ml-2"
                >
                  {(dispute.status === 'escalated' ? unreadAdminMessages : unreadMessages)} nouveau{(dispute.status === 'escalated' ? unreadAdminMessages : unreadMessages) > 1 ? 'x' : ''}
                </Badge>
              )}
            </Button>
          </div>
        )}

        <DisputeResolution
          dispute={dispute}
          resolutionDetails={resolutionDetails}
          userRole={userRole}
          isExpired={isExpired}
          isDeleting={isDeleting}
          handleDeleteDispute={handleDeleteDispute}
        />
      </CardContent>

      {showMessaging && dispute.status === 'escalated' && (
        <Dialog open={showMessaging} onOpenChange={setShowMessaging}>
          <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
            <EscalatedDisputeMessaging
              disputeId={dispute.id}
              transactionId={transaction.id}
              status={dispute.status}
              onClose={() => setShowMessaging(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {showMessaging && dispute.status !== 'escalated' && dispute.conversation_id && (
        <UnifiedMessaging
          conversationId={dispute.conversation_id}
          open={showMessaging}
          onOpenChange={setShowMessaging}
          title="Discussion du litige"
          disputeId={dispute.id}
        />
      )}

      <CreateProposalDialog
        open={showProposalDialog}
        onOpenChange={setShowProposalDialog}
        onCreateProposal={async (data) => {
          await createProposal(data);
          onRefetch?.();
        }}
        isCreating={isCreating}
        transactionAmount={transaction.price}
        currency={transaction.currency}
      />
    </Card>
  );
};

export const DisputeCard = memo(DisputeCardComponent);
