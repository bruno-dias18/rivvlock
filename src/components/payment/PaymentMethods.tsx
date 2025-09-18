import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  QrCode, 
  CreditCard, 
  Smartphone, 
  Building2, 
  CheckCircle,
  ExternalLink
} from 'lucide-react';

interface PaymentMethodsProps {
  amount: number;
  currency: string;
  onPaymentSuccess?: () => void;
}

export const PaymentMethods = ({ amount, currency, onPaymentSuccess }: PaymentMethodsProps) => {
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const paymentMethods = [
    {
      id: 'stripe',
      name: 'Carte bancaire',
      description: 'Paiement sécurisé par carte',
      icon: CreditCard,
      badge: 'Recommandé',
      badgeColor: 'bg-green-100 text-green-800',
      available: true
    },
    {
      id: 'qr-code',
      name: 'QR Code Checkout',
      description: 'Scannez avec votre app bancaire',
      icon: QrCode,
      badge: 'Instantané',
      badgeColor: 'bg-blue-100 text-blue-800',
      available: true
    },
    {
      id: 'twint',
      name: 'Twint',
      description: 'Paiement mobile suisse',
      icon: Smartphone,
      badge: 'CH uniquement',
      badgeColor: 'bg-purple-100 text-purple-800',
      available: currency === 'CHF'
    },
    {
      id: 'sepa',
      name: 'Virement SEPA',
      description: 'Virement bancaire européen',
      icon: Building2,
      badge: '1-2 jours',
      badgeColor: 'bg-orange-100 text-orange-800',
      available: currency === 'EUR'
    }
  ];

  const handlePaymentMethodSelect = async (methodId: string) => {
    setSelectedMethod(methodId);
    setIsProcessing(true);

    // Mock payment processing
    setTimeout(() => {
      switch (methodId) {
        case 'stripe':
          toast({
            title: '🔒 Redirection Stripe',
            description: 'Ouverture du paiement sécurisé...',
          });
          // In real app: redirect to Stripe Checkout
          window.open('https://checkout.stripe.com/mock', '_blank');
          break;
          
        case 'qr-code':
          toast({
            title: '📱 QR Code généré',
            description: 'Scannez le code avec votre app bancaire.',
          });
          // Mock QR code success
          setTimeout(() => {
            if (onPaymentSuccess) onPaymentSuccess();
            toast({
              title: '✅ Paiement confirmé !',
              description: `Fonds de ${amount} ${currency} bloqués avec succès.`,
            });
          }, 3000);
          break;
          
        case 'twint':
          toast({
            title: '📱 Ouverture Twint',
            description: 'Redirection vers l\'app Twint...',
          });
          // Mock Twint success
          setTimeout(() => {
            if (onPaymentSuccess) onPaymentSuccess();
            toast({
              title: '✅ Paiement Twint confirmé !',
              description: `${amount} ${currency} bloqués via Twint.`,
            });
          }, 2000);
          break;
          
        case 'sepa':
          toast({
            title: '🏦 Instructions SEPA',
            description: 'RIB communiqué par email. Virement sous 1-2 jours.',
          });
          break;
      }
      
      setIsProcessing(false);
      setSelectedMethod(null);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Bloquer les fonds</h3>
        <p className="text-sm text-muted-foreground">
          Montant: <span className="font-semibold text-foreground">{amount} {currency}</span>
        </p>
      </div>

      <div className="grid gap-3">
        {paymentMethods
          .filter(method => method.available)
          .map((method) => {
            const Icon = method.icon;
            const isSelected = selectedMethod === method.id;
            
            return (
              <Card 
                key={method.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => handlePaymentMethodSelect(method.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-white' : 'bg-accent'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium">{method.name}</div>
                        <div className="text-sm text-muted-foreground">{method.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={method.badgeColor}>
                        {method.badge}
                      </Badge>
                      {isSelected && isProcessing && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          🔒 Paiement sécurisé • Fonds bloqués jusqu'à validation mutuelle
        </p>
      </div>
    </div>
  );
};