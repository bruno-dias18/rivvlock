import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CompleteTransactionButtonProps {
  transactionId: string;
  transactionStatus: string;
  isUserBuyer: boolean;
  sellerHasStripeAccount?: boolean;
  onTransferComplete?: () => void;
}

export default function CompleteTransactionButton({
  transactionId,
  transactionStatus,
  isUserBuyer,
  sellerHasStripeAccount = false,
  onTransferComplete
}: CompleteTransactionButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Only show for paid transactions where user is buyer
  if (transactionStatus !== 'paid' || !isUserBuyer) {
    return null;
  }

  const handleCompleteTransaction = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('release-funds', {
        body: { transactionId }
      });

      if (error) throw error;
      
      toast.success('Transaction finalisée ! Les fonds ont été transférés au vendeur.');
      
      if (onTransferComplete) {
        onTransferComplete();
      }
    } catch (error: any) {
      console.error('Error processing transfer:', error);
      
      let errorMessage = 'Erreur lors du transfert des fonds';
      if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!sellerHasStripeAccount) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Le vendeur n'a pas encore configuré ses coordonnées bancaires. 
          Le transfert des fonds ne peut pas être effectué pour le moment.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          Le paiement a été effectué avec succès. Vous pouvez maintenant finaliser 
          la transaction pour transférer les fonds au vendeur.
        </AlertDescription>
      </Alert>
      
      <Button
        onClick={handleCompleteTransaction}
        disabled={isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Transfert en cours...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Finaliser la transaction
          </>
        )}
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        Une commission de 5% sera prélevée sur le montant total.
      </p>
    </div>
  );
}