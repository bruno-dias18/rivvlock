import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DateTimePicker } from '@/components/DateTimePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface DateChangeRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  currentDate?: string;
  maxChangesReached?: boolean;
  onSuccess?: () => void;
}

export const DateChangeRequestDialog: React.FC<DateChangeRequestDialogProps> = ({
  isOpen,
  onClose,
  transactionId,
  currentDate,
  maxChangesReached = false,
  onSuccess
}) => {
  const [proposedDate, setProposedDate] = useState<Date | undefined>(
    currentDate ? new Date(currentDate) : undefined
  );
  const [proposedEndDate, setProposedEndDate] = useState<Date | undefined>();
  const [paymentDeadlineHours, setPaymentDeadlineHours] = useState<'24' | '72' | '168'>('24');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset end date if it becomes invalid
  useEffect(() => {
    if (proposedDate && proposedEndDate && proposedEndDate < proposedDate) {
      setProposedEndDate(undefined);
    }
  }, [proposedDate, proposedEndDate]);

  const handleSubmit = async () => {
    if (!proposedDate) {
      toast.error('Veuillez sélectionner une nouvelle date');
      return;
    }

    if (proposedEndDate && proposedEndDate < proposedDate) {
      toast.error('La date de fin ne peut pas être antérieure à la date de début');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase.functions.invoke('request-date-change', {
        body: {
          transactionId,
          proposedDate: proposedDate.toISOString(),
          proposedEndDate: proposedEndDate?.toISOString(),
          paymentDeadlineHours: parseInt(paymentDeadlineHours),
          message: message.trim() || undefined
        }
      });

      if (error) {
        throw error;
      }

      toast.success('Demande de modification de date envoyée');
      onSuccess?.();
      onClose();
      
      // Reset form
      setMessage('');
      setProposedDate(currentDate ? new Date(currentDate) : undefined);
    } catch (error: any) {
      logger.error('Error requesting date change:', error);
      
      let errorMessage = 'Erreur lors de la demande de modification';
      
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        errorMessage = 'Transaction introuvable';
      } else if (error.message?.includes('403') || error.message?.includes('Not authorized')) {
        errorMessage = 'Non autorisé - seul le vendeur peut modifier la date';
      } else if (error.message?.includes('400') || error.message?.includes('Maximum number')) {
        errorMessage = 'Limite de modifications atteinte (2 maximum)';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setMessage('');
    setProposedDate(currentDate ? new Date(currentDate) : undefined);
    setProposedEndDate(undefined);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Modifier la date de service
          </DialogTitle>
          <DialogDescription>
            Proposez une nouvelle date de service. Le client devra approuver cette modification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {maxChangesReached && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Vous avez atteint le nombre maximum de modifications de date (2) pour cette transaction.
              </AlertDescription>
            </Alert>
          )}

          {!maxChangesReached && (
            <>
              <div className="space-y-2">
                <Label>Nouvelle date de début de service</Label>
                <DateTimePicker
                  date={proposedDate}
                  onDateChange={setProposedDate}
                  placeholder="Sélectionner la nouvelle date de début..."
                />
              </div>

              <div className="space-y-2">
                <Label>Nouvelle date de fin de service (optionnel)</Label>
                <DateTimePicker
                  date={proposedEndDate}
                  onDateChange={setProposedEndDate}
                  placeholder="Sélectionner la nouvelle date de fin..."
                  minDate={proposedDate}
                  disabled={!proposedDate}
                />
                <p className="text-xs text-muted-foreground">
                  Pour les services de plusieurs jours
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-deadline">Délai de paiement</Label>
                <Select 
                  value={paymentDeadlineHours} 
                  onValueChange={(value: '24' | '72' | '168') => setPaymentDeadlineHours(value)}
                >
                  <SelectTrigger id="payment-deadline">
                    <SelectValue placeholder="Sélectionner le délai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 heures avant le service</SelectItem>
                    <SelectItem value="72">3 jours avant le service</SelectItem>
                    <SelectItem value="168">1 semaine avant le service</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  L'acheteur devra payer avant cette échéance
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message explicatif (optionnel)</Label>
                <Textarea
                  id="message"
                  placeholder="Expliquez la raison du changement de date..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          {!maxChangesReached && (
            <Button 
              onClick={handleSubmit}
              disabled={isLoading || !proposedDate}
            >
              {isLoading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Envoyer la demande
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};