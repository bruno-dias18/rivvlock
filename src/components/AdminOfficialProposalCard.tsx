import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { useQueryClient } from '@tanstack/react-query';

interface AdminOfficialProposalCardProps {
  proposal: any;
  transaction: any;
  onRefetch?: () => void;
}

export const AdminOfficialProposalCard: React.FC<AdminOfficialProposalCardProps> = ({
  proposal,
  transaction,
  onRefetch,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = React.useState(false);

  const isSeller = user?.id === transaction.user_id;
  const isBuyer = user?.id === transaction.buyer_id;
  const hasUserValidated = isSeller ? proposal.seller_validated : proposal.buyer_validated;
  const otherPartyValidated = isSeller ? proposal.buyer_validated : proposal.seller_validated;

  const proposalText = proposal.proposal_type === 'partial_refund'
    ? `Remboursement de ${proposal.refund_percentage}%`
    : proposal.proposal_type === 'full_refund'
    ? 'Remboursement complet (100%)'
    : 'Pas de remboursement - Fonds libérés au vendeur';

  const handleValidation = async (action: 'accept' | 'reject') => {
    setIsValidating(true);
    try {
      const { error } = await supabase.functions.invoke('validate-admin-proposal', {
        body: {
          proposalId: proposal.id,
          action,
        },
      });

      if (error) throw error;

      if (action === 'accept') {
        toast.success("Validation enregistrée avec succès");
      } else {
        toast.success("Proposition rejetée");
      }
      
      // Invalider les caches React Query pour forcer le rafraîchissement
      queryClient.invalidateQueries({ queryKey: ['dispute-proposals', proposal.dispute_id] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', proposal.dispute_id] });
      
      // Garder le callback existant pour compatibilité
      onRefetch?.();
    } catch (error) {
      logger.error('Error validating proposal:', error);
      toast.error("Erreur lors de la validation");
    } finally {
      setIsValidating(false);
    }
  };

  const getTimeRemaining = () => {
    if (!proposal.expires_at || proposal.status !== 'pending') return null;
    
    const deadline = new Date(proposal.expires_at);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes };
  };

  const timeRemaining = getTimeRemaining();

  if (proposal.status === 'accepted') {
    return (
      <div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-300 dark:border-green-700 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-green-900 dark:text-green-100">
                Proposition officielle acceptée ✅
              </h4>
              <Badge className="bg-green-600 text-white">Traitée</Badge>
            </div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
              {proposalText}
            </p>
            {proposal.message && (
              <p className="text-sm text-green-700 dark:text-green-300 whitespace-pre-wrap">
                {proposal.message}
              </p>
            )}
            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
              Les deux parties ont validé - Traitement effectué automatiquement
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (proposal.status === 'rejected') {
    // Déterminer qui a rejeté
    const rejectedBySeller = proposal.rejected_by === transaction.user_id;
    const rejectedByBuyer = proposal.rejected_by === transaction.buyer_id;
    const rejectedByLabel = rejectedBySeller ? 'par le Vendeur' : 
                            rejectedByBuyer ? 'par l\'Acheteur' : '';
    
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border-2 border-red-300 dark:border-red-700 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-red-900 dark:text-red-100">
                Proposition officielle rejetée ❌
              </h4>
              <Badge className="bg-red-600 text-white">
                Refusée {rejectedByLabel}
              </Badge>
            </div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
              {proposalText}
            </p>
            {proposal.message && (
              <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
                {proposal.message}
              </p>
            )}
            {rejectedByLabel && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                🚫 Rejeté {rejectedByLabel}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (proposal.status === 'expired') {
    return (
      <div className="bg-gray-50 dark:bg-gray-950/20 border-2 border-gray-300 dark:border-gray-700 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="h-6 w-6 text-gray-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Proposition officielle expirée ⏰
              </h4>
              <Badge className="bg-gray-600 text-white">Expirée</Badge>
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
              {proposalText}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pending status
  return (
    <div className="bg-purple-50 dark:bg-purple-950/20 border-2 border-purple-300 dark:border-purple-700 p-4 rounded-lg">
      <div className="flex items-start gap-3">
        <Shield className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 min-w-0">
                <span className="hidden sm:inline">🔔 Proposition officielle de l'administration</span>
                <span className="sm:hidden">🔔 Proposition officielle</span>
              </h4>
              <Badge className="bg-purple-600 text-white flex-shrink-0">En attente</Badge>
            </div>
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
              {proposalText}
            </p>

            {/* Fee breakdown for partial refunds */}
            {proposal.proposal_type === 'partial_refund' && transaction?.price && (
              <div className="bg-white/70 dark:bg-black/30 p-3 rounded border border-purple-200 dark:border-purple-800 mb-2">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💰 Remboursement acheteur (net):</span>
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      {(transaction.price * proposal.refund_percentage / 100 * 0.95).toFixed(2)} {transaction.currency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">💵 Paiement vendeur (net):</span>
                    <span className="font-medium text-purple-700 dark:text-purple-300">
                      {(transaction.price * (100 - proposal.refund_percentage) / 100 * 0.95).toFixed(2)} {transaction.currency?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-purple-200 dark:border-purple-700">
                    <span className="text-orange-600 dark:text-orange-400">⚡ Frais RivvLock (5%):</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {(transaction.price * 0.05).toFixed(2)} {transaction.currency?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {proposal.message && (
              <div className="bg-white/50 dark:bg-black/20 p-3 rounded border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-purple-700 dark:text-purple-300 whitespace-pre-wrap">
                  {proposal.message}
                </p>
              </div>
            )}
          </div>

          {/* Validation status */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
            <div className="flex items-center gap-1">
              {proposal.seller_validated ? (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
              )}
              <span className={proposal.seller_validated ? "text-green-600 font-medium" : "text-muted-foreground"}>
                Vendeur {proposal.seller_validated ? "a validé" : "en attente"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {proposal.buyer_validated ? (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-orange-600 flex-shrink-0" />
              )}
              <span className={proposal.buyer_validated ? "text-green-600 font-medium" : "text-muted-foreground"}>
                Acheteur {proposal.buyer_validated ? "a validé" : "en attente"}
              </span>
            </div>
          </div>

          {timeRemaining && (
            <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
              <Clock className="h-3 w-3" />
              <span>
                Temps restant: {timeRemaining.hours}h {timeRemaining.minutes}min
              </span>
            </div>
          )}

          {/* Action buttons for user */}
          {!hasUserValidated && (isSeller || isBuyer) && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="success"
                size="default"
                onClick={() => handleValidation('accept')}
                disabled={isValidating}
                className="flex-1 py-3 sm:h-10 sm:py-2"
              >
                <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">{isValidating ? "Validation..." : "Accepter la proposition"}</span>
                <span className="sm:hidden">{isValidating ? "Validation..." : "Accepter"}</span>
              </Button>
              <Button
                variant="destructive"
                size="default"
                onClick={() => handleValidation('reject')}
                disabled={isValidating}
                className="flex-1 py-3 sm:h-10 sm:py-2"
              >
                <XCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                Refuser
              </Button>
            </div>
          )}

          {hasUserValidated && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Vous avez validé cette proposition
                </p>
              </div>
              {!otherPartyValidated && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  En attente de la validation de l'autre partie...
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-purple-600 dark:text-purple-400">
            ⚠️ Les deux parties doivent valider pour que le traitement soit automatique
          </p>
        </div>
      </div>
    </div>
  );
};
