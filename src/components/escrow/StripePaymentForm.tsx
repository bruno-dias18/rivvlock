import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CreditCard, QrCode, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';

interface StripePaymentFormProps {
  transaction: {
    id: string;
    title: string;
    price: number;
    currency: string;
    user_id: string;
    buyer_id: string | null;
  };
  clientSecret: string;
  onSuccess: () => void;
}

export const StripePaymentForm = ({ transaction, clientSecret, onSuccess }: StripePaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setPaymentError(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setPaymentError(error.message || 'Une erreur est survenue lors du paiement');
      } else if (paymentIntent && paymentIntent.status === 'requires_capture') {
        // Payment authorized successfully for escrow
        console.log('Test: PaymentLink - Payment authorized successfully');
        console.log('Test: PaymentLink - Payment Intent ID:', paymentIntent.id);
        console.log('Test: PaymentLink - Amount:', paymentIntent.amount, 'Currency:', paymentIntent.currency);
        
        // Update transaction status to 'paid'
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'paid',
            payment_blocked_at: new Date().toISOString(),
            validation_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
          })
          .eq('id', transaction.id);

        if (updateError) {
          console.error('Error updating transaction status:', updateError);
          throw updateError;
        }

        console.log('Test: PaymentLink - Transaction status updated to "paid"');

        toast({
          title: '✅ Paiement autorisé !',
          description: `${formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')} bloqués en escrow. Fonds libérés après validation mutuelle.`,
        });

        // Trigger notifications (optional, non-critical)
        try {
          await supabase.functions.invoke('send-notifications', {
            body: {
              type: 'payment_authorized',
              transactionId: transaction.id,
              amount: transaction.price,
              currency: transaction.currency
            }
          });
          console.log('Test: PaymentLink - Notifications sent');
        } catch (notificationError) {
          console.error('Notification error (non-critical):', notificationError);
        }

        onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError('Une erreur est survenue lors du traitement du paiement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Paiement sécurisé via Stripe
        </CardTitle>
        <CardDescription>
          Montant à bloquer : <span className="font-semibold gradient-text">
            {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {paymentError && (
          <Alert variant="destructive">
            <AlertDescription>{paymentError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement 
            options={{
              layout: 'tabs'
            }}
          />
          
          <div className="flex gap-3">
            <Button 
              type="submit" 
              disabled={!stripe || isLoading}
              className="flex-1 gradient-primary text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Bloquer les fonds
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Paiement sécurisé :</strong> Vos fonds seront bloqués de manière sécurisée et libérés 
            uniquement après validation mutuelle du service.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Alternative payment methods component
export const AlternativePaymentMethods = ({ transaction }: { transaction: any }) => {
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const handleAlternativePayment = async (method: string) => {
    toast({
      title: 'Fonctionnalité à venir',
      description: `Le paiement via ${method} sera bientôt disponible.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autres méthodes de paiement</CardTitle>
        <CardDescription>
          Montant : {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start h-auto p-4"
          onClick={() => handleAlternativePayment('QR Code')}
        >
          <QrCode className="w-5 h-5 mr-3" />
          <div className="text-left">
            <div className="font-medium">QR Code</div>
            <div className="text-sm text-muted-foreground">Scan pour payer (Mock)</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start h-auto p-4"
          onClick={() => handleAlternativePayment('Virement SEPA')}
        >
          <CreditCard className="w-5 h-5 mr-3" />
          <div className="text-left">
            <div className="font-medium">Virement bancaire</div>
            <div className="text-sm text-muted-foreground">SEPA/Swift (Mock)</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start h-auto p-4"
          onClick={() => handleAlternativePayment('Twint')}
        >
          <Smartphone className="w-5 h-5 mr-3" />
          <div className="text-left">
            <div className="font-medium">Twint</div>
            <div className="text-sm text-muted-foreground">Paiement mobile suisse (Mock)</div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
};