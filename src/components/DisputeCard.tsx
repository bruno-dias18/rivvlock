import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Clock, AlertTriangle, Send, Users, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { DisputeMessaging } from './DisputeMessaging';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/lib/mobileUtils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';

interface DisputeCardProps {
  dispute: any;
  onRefetch?: () => void;
}

export const DisputeCard: React.FC<DisputeCardProps> = ({ dispute, onRefetch }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(!isMobile);
  const [isDisputeMessageExpanded, setIsDisputeMessageExpanded] = useState(!isMobile);

  const transaction = dispute.transactions;
  if (!transaction) return null;

  const getUserRole = () => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return 'reporter';
  };

  const userRole = getUserRole();
  const isReporter = dispute.reporter_id === user?.id;
  const canRespond = userRole === 'seller' && !isReporter && dispute.status === 'open';

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
  const isExpired = dispute.status === 'escalated';

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('respond-to-dispute', {
        body: {
          disputeId: dispute.id,
          response: responseText.trim()
        }
      });

      if (error) throw error;

      toast.success("Réponse envoyée avec succès");
      setIsResponding(false);
      setResponseText('');
      onRefetch?.();
    } catch (error) {
      console.error('Error responding to dispute:', error);
      toast.error("Erreur lors de l'envoi de la réponse");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm md:text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Litige #{dispute.id.slice(0, 8)}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              Transaction: {dispute.transactions?.title}
            </p>
            {timeRemaining && !isExpired && !dispute.status.startsWith('resolved') && (
              <div className="flex items-center gap-1 mt-2 text-orange-600 dark:text-orange-400 overflow-hidden">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium whitespace-nowrap">
                  {timeRemaining.hours}h {timeRemaining.minutes}min restantes pour la résolution amiable
                </span>
              </div>
            )}
            {isExpired && (
              <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Escaladé au support client pour arbitrage
                </span>
              </div>
            )}
          </div>
          <Badge className={`${getStatusColor(dispute.status)} flex-shrink-0 text-xs md:text-sm`}>
            {getStatusText(dispute.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Transaction Details - Only show for non-resolved disputes */}
        {!dispute.status.startsWith('resolved') && (
          <Collapsible open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
          <div className="bg-muted/50 rounded-lg">
            <CollapsibleTrigger asChild>
              <button className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/70 transition-colors rounded-lg">
                <h4 className="font-medium text-sm">Détails de la transaction</h4>
                {isMobile && (
                  isTransactionDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-3 pb-3">
                {isMobile ? (
                  // Mobile: Compact view - only essential info
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="font-medium">
                        {dispute.transactions?.price} {dispute.transactions?.currency?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Statut:</span>
                      <Badge variant="outline" className="text-xs">
                        {dispute.transactions?.status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  // Desktop: Full grid view
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="ml-2 font-medium">
                        {dispute.transactions?.price} {dispute.transactions?.currency?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date du service:</span>
                      <span className="ml-2">
                        {dispute.transactions?.service_date 
                          ? format(new Date(dispute.transactions.service_date), 'dd/MM/yyyy', { locale: fr })
                          : 'Non définie'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendeur:</span>
                      <span className="ml-2">{dispute.transactions?.seller_display_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Acheteur:</span>
                      <span className="ml-2">{dispute.transactions?.buyer_display_name || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
          </Collapsible>
        )}

        {/* Dispute Information - Only show for non-resolved disputes */}
        {!dispute.status.startsWith('resolved') && (
          <Collapsible open={isDisputeMessageExpanded} onOpenChange={setIsDisputeMessageExpanded}>
          <div>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <h4 className="font-medium text-sm">Type: {getDisputeTypeText(dispute.dispute_type)}</h4>
                  </div>
                  {isMobile && (
                    isDisputeMessageExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Message initial du client:</strong>
                </p>
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {isMobile && !isDisputeMessageExpanded && dispute.reason.length > 100
                    ? `${dispute.reason.substring(0, 100)}...`
                    : dispute.reason
                  }
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Signalé le {format(new Date(dispute.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            </CollapsibleContent>
          </div>
          </Collapsible>
        )}

        {/* Unified Conversation */}
        {['open', 'negotiating', 'responded'].includes(dispute.status) && (
          <div>
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Conversation
            </h4>
            
            <div className={isMobile ? "h-[350px]" : "h-[400px]"}>
              <DisputeMessaging
                disputeId={dispute.id}
                disputeDeadline={dispute.dispute_deadline}
                status={dispute.status}
                onProposalSent={() => {
                  onRefetch?.();
                }}
              />
            </div>
          </div>
        )}

        {/* Résumé condensé - Litige résolu */}
        {dispute.status.startsWith('resolved') && (
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h4 className="font-medium">Litige résolu</h4>
            </div>
            <div className="space-y-1 text-sm">
              {dispute.resolution && (
                <p className="text-foreground">{dispute.resolution}</p>
              )}
              {dispute.resolved_at && (
                <p className="text-xs text-muted-foreground">
                  Résolu le {format(new Date(dispute.resolved_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Escalated - Admin View */}
        {isExpired && (
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-purple-600" />
              <h4 className="font-medium text-sm">Litige escaladé au support</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Ce litige n'a pas pu être résolu à l'amiable dans les 48h. 
              Il est maintenant traité par l'équipe support pour arbitrage.
            </p>
            {dispute.escalated_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Escaladé le {format(new Date(dispute.escalated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            )}
            
            <Separator className="my-3" />
            
            {/* Show messaging history even when escalated */}
            <div>
              <h5 className="font-medium text-sm mb-2">Historique de la conversation:</h5>
              <div className={isMobile ? "h-[350px]" : "h-[400px]"}>
                <DisputeMessaging
                  disputeId={dispute.id}
                  disputeDeadline={dispute.dispute_deadline}
                  status={dispute.status}
                />
              </div>
            </div>
          </div>
        )}

        {/* Admin Notes */}
        {dispute.admin_notes && (
          <div>
            <h4 className="font-medium text-sm mb-2">Notes administratives:</h4>
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{dispute.admin_notes}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};