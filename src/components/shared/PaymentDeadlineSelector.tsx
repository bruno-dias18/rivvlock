import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface Props {
  value: '24' | '72' | '168';
  onChange: (value: '24' | '72' | '168') => void;
  serviceDate?: Date;
  disabled?: boolean;
  label?: string;
  showInfo?: boolean;
}

export const PaymentDeadlineSelector = ({ 
  value, 
  onChange, 
  serviceDate,
  disabled = false,
  label = 'Délai de paiement avant prestation',
  showInfo = true
}: Props) => {
  const calculatePaymentDeadline = (): string | null => {
    if (!serviceDate) return null;
    const hours = parseInt(value);
    const deadline = new Date(serviceDate.getTime() - hours * 60 * 60 * 1000);
    return deadline.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const paymentDeadline = calculatePaymentDeadline();

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="payment-deadline">{label} *</Label>
        <Select 
          value={value} 
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger id="payment-deadline">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24">24 heures avant</SelectItem>
            <SelectItem value="72">3 jours avant</SelectItem>
            <SelectItem value="168">7 jours avant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showInfo && (
        <Alert className="text-xs">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {paymentDeadline ? (
              <>
                <strong>Deadline de paiement :</strong> {paymentDeadline}
                <br />
                Le client devra payer avant cette date. Les fonds seront bloqués sur RivvLock jusqu'à la validation du service.
              </>
            ) : (
              'Sélectionnez une date de prestation pour voir la deadline de paiement'
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
