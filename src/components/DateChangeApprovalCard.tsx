import React, { useState } from 'react';
import { Calendar, Check, X, Clock, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logger } from '@/lib/logger';

interface DateChangeApprovalCardProps {
  transaction: any;
  onResponse?: () => void;
}

export const DateChangeApprovalCard: React.FC<DateChangeApprovalCardProps> = ({
  transaction,
  onResponse
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!transaction || transaction.date_change_status !== 'pending_approval') {
    return null;
  }

  const handleResponse = async (approved: boolean) => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.functions.invoke('respond-to-date-change', {
        body: {
          transactionId: transaction.id,
          approved
        }
      });

      if (error) {
        throw error;
      }

      toast.success(approved ? 'Modification de date acceptée' : 'Modification de date refusée');
      
      // Force refresh after successful response with a slight delay to ensure backend is updated
      setTimeout(() => {
        onResponse?.();
      }, 500);
    } catch (error: any) {
      logger.error('Error responding to date change:', error);
      toast.error(error.message || 'Erreur lors de la réponse');
    } finally {
      setIsLoading(false);
    }
  };

  const currentDate = transaction.service_date ? new Date(transaction.service_date) : null;
  const proposedDate = transaction.proposed_service_date ? new Date(transaction.proposed_service_date) : null;
  const isExpired = transaction.status === 'expired';

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Calendar className="h-5 w-5" />
          {currentDate ? 'Demande de modification de date' : 'Proposition de date de service'}
        </CardTitle>
        <CardDescription>
          {currentDate 
            ? 'Le vendeur souhaite modifier la date de service de cette transaction.'
            : 'Le vendeur propose une date de service pour cette transaction.'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isExpired && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              Cette transaction est expirée. En acceptant cette modification, elle sera réactivée avec un nouveau délai de paiement de 24h.
            </AlertDescription>
          </Alert>
        )}
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {currentDate ? (
              "Une réponse de votre part est attendue. Si vous ne répondez pas, la transaction conservera la date actuelle."
            ) : (
              "Une réponse de votre part est attendue. Sans date de service validée, la transaction ne pourra pas progresser."
            )}
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Date actuelle</div>
            <div className="text-sm">
              {currentDate ? format(currentDate, 'PPPp', { locale: fr }) : 'Non définie'}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm font-medium text-orange-700">Nouvelle date proposée</div>
            <div className="text-sm font-semibold">
              {proposedDate ? format(proposedDate, 'PPPp', { locale: fr }) : 'Non définie'}
            </div>
          </div>
        </div>

        {transaction.date_change_message && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">Message du vendeur</div>
            <div className="text-sm p-3 bg-white rounded-md border">
              {transaction.date_change_message}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => handleResponse(true)}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Accepter
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => handleResponse(false)}
            disabled={isLoading}
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};