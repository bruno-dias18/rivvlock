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
  // Get both deadlines from transaction
  const cardDeadline = transaction?.payment_deadline_card || transaction?.payment_deadline;
  const bankDeadline = transaction?.payment_deadline_bank || transaction?.payment_deadline;
  
  const now = new Date().getTime();
  const cardTimeRemaining = cardDeadline ? new Date(cardDeadline).getTime() - now : 0;
  const bankTimeRemaining = bankDeadline ? new Date(bankDeadline).getTime() - now : 0;
  
  const cardHoursRemaining = cardTimeRemaining / (1000 * 60 * 60);
  const bankHoursRemaining = bankTimeRemaining / (1000 * 60 * 60);
  
  const cardDeadlineExpired = cardTimeRemaining <= 0;
  const bankDeadlineExpired = bankTimeRemaining <= 0;


  return (
    <div className="space-y-4" data-testid="payment-method-selector">
      <div>
        <h3 className="text-lg font-semibold mb-2">Choisissez votre méthode de paiement</h3>
        <p className="text-sm text-muted-foreground">
          Montant : <span className="font-medium">{transaction.price} {transaction.currency.toUpperCase()}</span>
        </p>
      </div>

      <RadioGroup 
        value={selectedMethod || undefined} 
        onValueChange={(value) => onMethodSelect(value as 'card' | 'bank_transfer')}
        className="space-y-3"
      >
        {/* Bank transfer option - NOW FIRST */}
        <div 
          className={`flex items-start space-x-3 p-4 rounded-lg transition-colors ${
            bankDeadlineExpired
              ? 'opacity-60 cursor-not-allowed bg-muted border' 
              : 'cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/20 border-2 border-green-600 dark:border-green-700'
          }`}
        >
          <RadioGroupItem 
            value="bank_transfer" 
            id="bank_transfer" 
            disabled={bankDeadlineExpired}
          />
          <Label 
            htmlFor="bank_transfer" 
            className={`flex-1 ${bankDeadlineExpired ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 mt-0.5 text-green-600 dark:text-green-500" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">🏦 Virement Bancaire</p>
                  {!bankDeadlineExpired && (
                    <Badge variant="success" className="text-xs">⭐ Recommandé</Badge>
                  )}
                  {bankDeadlineExpired && <Badge variant="destructive" className="text-xs">Expiré</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Virement SEPA (EUR) ou QR-Facture (CHF)
                </p>
                {!bankDeadlineExpired ? (
                  <>
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {bankHoursRemaining < 48 
                            ? `${Math.round(bankHoursRemaining)}h restantes` 
                            : `${Math.round(bankHoursRemaining / 24)} jours restants`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Avant le {bankDeadline && format(new Date(bankDeadline), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                      <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        <span className="font-semibold">Délai bancaire inclus :</span> 2-3 jours ouvrables pour le virement
                      </p>
                    </div>
                    {bankHoursRemaining < 96 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          💡 Initiez votre virement dès maintenant pour respecter le délai
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                ) : (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Délai expiré</AlertTitle>
                    <AlertDescription className="text-xs">
                      Le délai pour le virement bancaire est dépassé.
                      {!cardDeadlineExpired && (
                        <>
                          <br />
                          💡 Utilisez le paiement par carte pour un règlement immédiat.
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </Label>
        </div>

        {/* Card payment option - NOW SECOND */}
        <div className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
          cardDeadlineExpired 
            ? 'opacity-60 cursor-not-allowed bg-muted' 
            : 'cursor-pointer hover:bg-accent'
        }`}>
          <RadioGroupItem value="card" id="card" disabled={cardDeadlineExpired} />
          <Label 
            htmlFor="card" 
            className={`flex-1 ${cardDeadlineExpired ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 mt-0.5 text-primary" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium">💳 Paiement par Carte</p>
                  {!cardDeadlineExpired && <Badge variant="secondary" className="text-xs">⚡ Instantané</Badge>}
                  {cardDeadlineExpired && <Badge variant="destructive" className="text-xs">Expiré</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Paiement sécurisé instantané par carte bancaire
                </p>
                {!cardDeadlineExpired && cardDeadline && (
                  <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-primary" />
                      <span className="font-semibold text-primary">
                        {cardHoursRemaining < 48 
                          ? `${Math.round(cardHoursRemaining)}h restantes` 
                          : `${Math.round(cardHoursRemaining / 24)} jours restants`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Avant le {format(new Date(cardDeadline), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                )}
                {cardDeadlineExpired && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Le délai de paiement par carte est expiré
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