import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, MessageSquare, Calendar, User, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/lib/mobileUtils';

interface DisputeCardProps {
  dispute: any;
  onRefetch?: () => void;
}

export function DisputeCard({ dispute, onRefetch }: DisputeCardProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isResponding, setIsResponding] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        return 'destructive';
      case 'responded':
        return 'secondary';
      case 'resolved_refund':
        return 'secondary';
      case 'resolved_release':
        return 'default';
      default:
        return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Ouvert';
      case 'responded':
        return 'Répondu';
      case 'resolved_refund':
        return 'Résolu - Remboursé';
      case 'resolved_release':
        return 'Résolu - Fonds libérés';
      default:
        return status;
    }
  };

  const getDisputeTypeText = (type: string) => {
    switch (type) {
      case 'quality_issue':
        return 'Problème de qualité';
      case 'non_delivery':
        return 'Non-livraison';
      case 'service_issue':
        return 'Problème de service';
      case 'other':
        return 'Autre';
      default:
        return type;
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Veuillez saisir une réponse');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('respond-to-dispute', {
        body: {
          disputeId: dispute.id,
          response: responseText.trim()
        }
      });

      if (error) throw error;

      toast.success('Réponse envoyée avec succès');
      setIsResponding(false);
      setResponseText('');
      onRefetch?.();
    } catch (error) {
      console.error('Error responding to dispute:', error);
      toast.error('Erreur lors de l\'envoi de la réponse');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <CardTitle className="text-lg">{transaction.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusColor(dispute.status)}>
                  {getStatusText(dispute.status)}
                </Badge>
                <Badge variant="outline">
                  {getDisputeTypeText(dispute.dispute_type)}
                </Badge>
              </div>
            </div>
          </div>
          <div className={`text-sm text-muted-foreground ${isMobile ? 'text-left' : 'text-right'}`}>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(dispute.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Transaction Details */}
        <div className="bg-background/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium">Détails de la transaction</h4>
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-sm`}>
            <div>
              <span className="text-muted-foreground">Montant:</span> {transaction.price} {transaction.currency}
            </div>
            <div>
              <span className="text-muted-foreground">Date de service:</span>{' '}
              {transaction.service_date ? new Date(transaction.service_date).toLocaleDateString('fr-FR') : 'Non définie'}
            </div>
          </div>
          {transaction.description && (
            <div>
              <span className="text-muted-foreground">Description:</span> {transaction.description}
            </div>
          )}
        </div>

        {/* Dispute Message */}
        <div className="bg-destructive/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-destructive" />
            <h4 className="font-medium text-destructive">
              Message du {isReporter ? 'client' : userRole === 'seller' ? 'client' : 'reporter'}
            </h4>
          </div>
          <p className="text-sm whitespace-pre-wrap">{dispute.reason}</p>
        </div>

        {/* Seller Response Section */}
        {canRespond && (
          <div className="space-y-3">
            {!isResponding ? (
              <Button 
                onClick={() => setIsResponding(true)}
                variant="outline"
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                Répondre au litige
              </Button>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Expliquez votre position concernant ce litige..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                />
                <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
                  <Button 
                    onClick={handleSubmitResponse}
                    disabled={isSubmitting || !responseText.trim()}
                    className={isMobile ? 'order-1' : ''}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isSubmitting ? 'Envoi...' : 'Envoyer la réponse'}
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsResponding(false);
                      setResponseText('');
                    }}
                    variant="outline"
                    disabled={isSubmitting}
                    className={isMobile ? 'order-2' : ''}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show seller response if exists */}
        {dispute.resolution && (
          <div className="bg-secondary/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-secondary-foreground" />
              <h4 className="font-medium">Réponse du vendeur</h4>
            </div>
            <p className="text-sm whitespace-pre-wrap">{dispute.resolution}</p>
          </div>
        )}

        {/* Admin notes if exists */}
        {dispute.admin_notes && (
          <div className="bg-primary/10 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-primary">Notes administratives</h4>
            <p className="text-sm whitespace-pre-wrap">{dispute.admin_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}