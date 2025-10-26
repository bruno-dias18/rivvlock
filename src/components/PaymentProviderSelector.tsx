import { CreditCard, Smartphone } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface PaymentProviderSelectorProps {
  selectedProvider: 'stripe' | 'adyen' | null;
  onProviderSelect: (provider: 'stripe' | 'adyen') => void;
}

export function PaymentProviderSelector({ 
  selectedProvider, 
  onProviderSelect 
}: PaymentProviderSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Choisissez votre processeur de paiement</h3>
      <RadioGroup 
        value={selectedProvider || ''} 
        onValueChange={(value) => onProviderSelect(value as 'stripe' | 'adyen')}
      >
        {/* Stripe Option */}
        <div className="flex items-center space-x-3 rounded-lg border-2 p-4 transition-all hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <RadioGroupItem value="stripe" id="stripe" />
          <Label 
            htmlFor="stripe" 
            className="flex-1 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Stripe</p>
                <p className="text-xs text-muted-foreground">
                  Carte, SEPA, Virement IBAN
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="ml-2">
              Standard
            </Badge>
          </Label>
        </div>

        {/* Adyen Option */}
        <div className="flex items-center space-x-3 rounded-lg border-2 p-4 transition-all hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <RadioGroupItem value="adyen" id="adyen" />
          <Label 
            htmlFor="adyen" 
            className="flex-1 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Adyen</p>
                <p className="text-xs text-muted-foreground">
                  Carte, Twint (CHF uniquement)
                </p>
              </div>
            </div>
            <Badge variant="outline" className="ml-2">
              Nouveau
            </Badge>
          </Label>
        </div>
      </RadioGroup>

      {selectedProvider && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
          {selectedProvider === 'stripe' ? (
            <p>
              <strong>Stripe</strong> : Processeur de paiement standard avec support carte bancaire, SEPA Direct Debit et virement IBAN virtuel.
            </p>
          ) : (
            <p>
              <strong>Adyen</strong> : Processeur alternatif avec support Twint (uniquement pour transactions en CHF). Idéal pour les paiements mobiles en Suisse.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
