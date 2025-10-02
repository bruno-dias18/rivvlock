import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DateTimePicker } from './DateTimePicker';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';

interface RenewTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newServiceDate?: Date, message?: string) => void;
  isLoading?: boolean;
}

export function RenewTransactionDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false
}: RenewTransactionDialogProps) {
  const { t } = useTranslation();
  const [newServiceDate, setNewServiceDate] = useState<Date>();
  const [newServiceEndDate, setNewServiceEndDate] = useState<Date>();
  const [message, setMessage] = useState('');

  const handleConfirm = () => {
    onConfirm(newServiceDate, message || undefined);
  };

  const handleCancel = () => {
    setNewServiceDate(undefined);
    setNewServiceEndDate(undefined);
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Relancer la transaction
          </DialogTitle>
          <DialogDescription>
            Cette transaction a expiré car le paiement n'a pas été effectué à temps. 
            Vous pouvez la relancer pour donner une nouvelle opportunité à l'acheteur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nouveau délai de paiement</Label>
            <p className="text-sm text-muted-foreground">
              Un nouveau délai de 48 heures sera automatiquement défini après la relance.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-date">Nouvelle date de début de service (optionnel)</Label>
            <DateTimePicker
              date={newServiceDate}
              onDateChange={setNewServiceDate}
            />
            <p className="text-xs text-muted-foreground">
              Vous pouvez proposer une nouvelle date de début si nécessaire
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-end-date">Nouvelle date de fin de service (optionnel)</Label>
            <DateTimePicker
              date={newServiceEndDate}
              onDateChange={setNewServiceEndDate}
            />
            <p className="text-xs text-muted-foreground">
              Pour les services de plusieurs jours
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message pour l'acheteur (optionnel)</Label>
            <Textarea
              id="message"
              placeholder="Expliquez pourquoi vous relancez cette transaction..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Relance en cours...' : 'Relancer la transaction'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
