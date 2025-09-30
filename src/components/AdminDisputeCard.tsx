import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Clock, AlertTriangle, Send, Users, Settings, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DisputeMessaging } from './DisputeMessaging';
import { useDisputeProposals } from '@/hooks/useDisputeProposals';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AdminDisputeCardProps {
  dispute: any;
  onRefetch?: () => void;
}

export const AdminDisputeCard: React.FC<AdminDisputeCardProps> = ({ dispute, onRefetch }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [showMessaging, setShowMessaging] = useState(false);
  const [isAddingNotes, setIsAddingNotes] = useState(false);
  const [adminNotes, setAdminNotes] = useState(dispute.admin_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { proposals } = useDisputeProposals(dispute.id);

  // Ensure transaction data is available even if join is not returned by Supabase
  const [transaction, setTransaction] = useState<any>(dispute.transactions);

  useEffect(() => {
    const fetchTx = async () => {
      if (!dispute.transactions && dispute.transaction_id) {
        const { data } = await supabase
          .from('transactions')
          .select('id, title, price, currency, service_date, status, seller_display_name, buyer_display_name')
          .eq('id', dispute.transaction_id)
          .maybeSingle();
        if (data) setTransaction(data);
      }
    };
    fetchTx();
  }, [dispute.transactions, dispute.transaction_id]);

  const sellerProfile = transaction?.profiles;
  const buyerProfile = transaction?.buyer_profiles;
  const reporterProfile = dispute.reporter_profiles;

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
  const isExpired = dispute.status === 'escalated' || (timeRemaining === null && dispute.dispute_deadline);

  const handleSaveNotes = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('disputes')
        .update({ admin_notes: adminNotes })
        .eq('id', dispute.id);

      if (error) throw error;

      toast.success("Notes administratives sauvegardées");
      setIsAddingNotes(false);
      onRefetch?.();
    } catch (error) {
      console.error('Error saving admin notes:', error);
      toast.error("Erreur lors de la sauvegarde des notes");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessDispute = async (action: 'refund' | 'release') => {
    const actionText = action === 'refund' ? 'rembourser' : 'libérer les fonds';
    if (!confirm(`Êtes-vous sûr de vouloir ${actionText} pour ce litige ?`)) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('process-dispute', {
        body: {
          disputeId: dispute.id,
          action,
          adminNotes: adminNotes
        }
      });

      if (error) throw error;

      toast.success(`Litige traité avec succès (${actionText})`);
      onRefetch?.();
    } catch (error) {
      console.error('Error processing dispute:', error);
      toast.error(`Erreur lors du traitement du litige`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              [ADMIN] Litige #{dispute.id.slice(0, 8)}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Transaction: {transaction?.title || '-'}
            </p>
            {timeRemaining && !isExpired && (
              <div className="flex items-center gap-1 mt-2 text-orange-600 dark:text-orange-400">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {timeRemaining.hours}h {timeRemaining.minutes}min restantes pour la résolution amiable
                </span>
              </div>
            )}
            {isExpired && (
              <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Escaladé au support - En attente d'arbitrage admin
                </span>
              </div>
            )}
          </div>
          <Badge className={getStatusColor(dispute.status)}>
            {getStatusText(dispute.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Participants Information */}
        <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participants au litige
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">Vendeur:</span>
              <p>{sellerProfile ? `${sellerProfile.first_name} ${sellerProfile.last_name}` : transaction.seller_display_name || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{sellerProfile?.user_type}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">Acheteur:</span>
              <p>{buyerProfile ? `${buyerProfile.first_name} ${buyerProfile.last_name}` : transaction.buyer_display_name || 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{buyerProfile?.user_type}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">Signalé par:</span>
              <p>{reporterProfile ? `${reporterProfile.first_name} ${reporterProfile.last_name}` : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">{reporterProfile?.user_type}</p>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <h4 className="font-medium text-sm mb-2">Détails de la transaction</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Montant:</span>
              <span className="ml-2 font-medium">
                {transaction?.price} {transaction?.currency?.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Date du service:</span>
              <span className="ml-2">
                {transaction?.service_date 
                  ? format(new Date(transaction.service_date), 'dd/MM/yyyy', { locale: fr })
                  : 'Non définie'
                }
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Statut transaction:</span>
              <span className="ml-2">{transaction?.status || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ID Transaction:</span>
              <span className="ml-2 font-mono text-xs">{transaction?.id?.slice(0, 8) || '-'}</span>
            </div>
          </div>
        </div>

        {/* Dispute Information */}
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Type de litige: {getDisputeTypeText(dispute.dispute_type)}
          </h4>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Message initial du client:</strong>
            </p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{dispute.reason}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Signalé le {format(new Date(dispute.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
          </p>
        </div>

        {/* Proposals History */}
        {proposals && proposals.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              📝 Historique des propositions formelles
            </h4>
            <div className="space-y-2">
              {proposals.map((proposal) => {
                const proposalText = proposal.proposal_type === 'partial_refund'
                  ? `Remboursement de ${proposal.refund_percentage}%`
                  : proposal.proposal_type === 'full_refund'
                  ? 'Remboursement complet (100%)'
                  : 'Pas de remboursement';

                const statusColor = 
                  proposal.status === 'accepted' 
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    : proposal.status === 'rejected'
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    : proposal.status === 'expired'
                    ? 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800'
                    : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';

                const statusText =
                  proposal.status === 'accepted' ? '✅ Acceptée'
                  : proposal.status === 'rejected' ? '❌ Refusée'
                  : proposal.status === 'expired' ? '⏰ Expirée'
                  : '⏳ En attente';

                return (
                  <div key={proposal.id} className={`border p-3 rounded-lg ${statusColor}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{proposalText}</div>
                        {proposal.message && (
                          <div className="text-xs text-muted-foreground mt-1">{proposal.message}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Proposé le {format(new Date(proposal.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {statusText}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Conversation History */}
        <div>
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Historique de la conversation
          </h4>
          
          <DisputeMessaging
            disputeId={dispute.id}
            disputeDeadline={dispute.dispute_deadline}
            status={dispute.status}
          />
        </div>

        {/* Admin Notes Section */}
        <Separator />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes administratives
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAddingNotes(!isAddingNotes)}
            >
              {isAddingNotes ? 'Annuler' : 'Modifier'}
            </Button>
          </div>
          
          {isAddingNotes ? (
            <div className="space-y-3">
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Ajoutez vos notes administratives concernant ce litige..."
                className="min-h-[100px]"
              />
              <Button
                onClick={handleSaveNotes}
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder les notes'}
              </Button>
            </div>
          ) : (
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
              {adminNotes ? (
                <p className="text-sm whitespace-pre-wrap">{adminNotes}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Aucune note administrative pour ce litige
                </p>
              )}
            </div>
          )}
        </div>

        {/* Admin Actions */}
        {dispute.status === 'escalated' && (
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Actions administratives
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Ce litige nécessite une décision administrative. Choisissez l'action appropriée :
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleProcessDispute('refund')}
                disabled={isProcessing}
                variant="destructive"
                className="flex-1 flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                {isProcessing ? 'Traitement...' : 'Rembourser l\'acheteur'}
              </Button>
              <Button
                onClick={() => handleProcessDispute('release')}
                disabled={isProcessing}
                className="flex-1 flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {isProcessing ? 'Traitement...' : 'Libérer les fonds'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Cette action est irréversible et traitera définitivement le litige.
            </p>
          </div>
        )}

        {/* Legacy Response (if exists) */}
        {dispute.resolution && (
          <div>
            <h4 className="font-medium text-sm mb-2">Réponse du vendeur (historique):</h4>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{dispute.resolution}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Répondu le {format(new Date(dispute.updated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};