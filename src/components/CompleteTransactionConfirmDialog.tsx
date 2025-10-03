import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CompleteTransactionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  transactionTitle: string;
  transactionAmount: number;
  transactionCurrency: string;
  isProcessing: boolean;
}

export function CompleteTransactionConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  transactionTitle,
  transactionAmount,
  transactionCurrency,
  isProcessing
}: CompleteTransactionConfirmDialogProps) {
  const currencySymbol = transactionCurrency === 'CHF' ? 'CHF' : '€';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Confirmer la finalisation ?
          </DialogTitle>
          <DialogDescription>
            Cette action est irréversible
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Une fois confirmé, les fonds seront transférés immédiatement au vendeur
              et vous ne pourrez plus les récupérer.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction :</span>
              <span className="font-medium">{transactionTitle}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Montant :</span>
              <span className="font-semibold text-lg">{transactionAmount.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Confirmez-vous que :</p>
            <ul className="space-y-1 ml-4">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Vous avez bien reçu le service/produit</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Tout est conforme à vos attentes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Vous souhaitez libérer les fonds au vendeur</span>
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className="bg-primary"
          >
            {isProcessing ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                Transfert en cours...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmer et finaliser
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
