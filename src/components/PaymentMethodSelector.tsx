import { Transaction } from "@/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Building2, Clock, AlertCircle, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PaymentMethodSelectorProps {
  transaction: Transaction;
  onMethodSelect: (method: 'card' | 'bank_transfer') => void;
  selectedMethod: 'card' | 'bank_transfer' | null;
}

export const PaymentMethodSelector = ({ 
  transaction, 
  onMethodSelect, 
  selectedMethod
}: PaymentMethodSelectorProps) => {
  const timeUntilDeadline = transaction?.payment_deadline 
    ? new Date(transaction.payment_deadline).getTime() - new Date().getTime()
    : 0;
  const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
  const bankTransferAllowed = hoursUntilDeadline >= 72;

  return (
    <div className="space-y-4" data-testid="payment-method-selector">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choisissez votre méthode de paiement</h3>
        <p className="text-sm text-muted-foreground">
          Montant : <span className="font-medium">{transaction.price} {transaction.currency.toUpperCase()}</span>
        </p>
      </div>

      {/* Payment deadline info */}
      {transaction.payment_deadline && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Paiement requis avant :</AlertTitle>
          <AlertDescription>
            <span className="font-medium">
              {format(new Date(transaction.payment_deadline), 'PPp', { locale: fr })}
            </span>
            <br />
            <span className="text-muted-foreground">
              ({hoursUntilDeadline < 48 
                ? `Dans ${Math.round(hoursUntilDeadline)} heures` 
                : `Dans ${Math.round(hoursUntilDeadline / 24)} jours`})
            </span>
          </AlertDescription>
        </Alert>
      )}

      <RadioGroup 
        value={selectedMethod || undefined} 
        onValueChange={(value) => onMethodSelect(value as 'card' | 'bank_transfer')}
        className="space-y-3"
      >
        {/* Card payment option */}
        <div className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors">
          <RadioGroupItem value="card" id="card" />
          <Label 
            htmlFor="card" 
            className="flex-1 cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Paiement par Carte</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Paiement sécurisé instantané par carte bancaire
                </p>
              </div>
            </div>
          </Label>
        </div>

        {/* Bank transfer option */}
        <div 
          className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
            bankTransferAllowed 
              ? 'cursor-pointer hover:bg-accent' 
              : 'opacity-60 cursor-not-allowed bg-muted'
          }`}
        >
          <RadioGroupItem 
            value="bank_transfer" 
            id="bank_transfer" 
            disabled={!bankTransferAllowed}
          />
          <Label 
            htmlFor="bank_transfer" 
            className={`flex-1 ${bankTransferAllowed ? 'cursor-pointer' : 'cursor-not-allowed'}`}
          >
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Virement Bancaire</p>
                  {!bankTransferAllowed && (
                    <Badge variant="destructive" className="text-xs">
                      Non disponible
                    </Badge>
                  )}
                </div>
                {bankTransferAllowed ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Virement SEPA (EUR) ou QR-Facture (CHF)
                    </p>
                    <div className="flex items-start gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                      <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-primary">
                        <span className="font-semibold">Délai standard :</span> 1-3 jours ouvrables pour virement SEPA
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Délai de paiement trop court</AlertTitle>
                    <AlertDescription className="text-xs">
                      Le virement bancaire nécessite au moins 72h avant la date limite de paiement.
                      <br />
                      Temps restant : <strong>{Math.round(hoursUntilDeadline)} heures</strong>
                      <br />
                      Veuillez utiliser le paiement par carte pour un règlement immédiat.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
};
