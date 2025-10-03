import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CompleteTransactionConfirmDialog } from '@/components/CompleteTransactionConfirmDialog';

interface CompleteTransactionButtonProps {
  transactionId: string;
  transactionStatus: string;
  isUserBuyer: boolean;
  sellerHasStripeAccount?: boolean;
  onTransferComplete?: () => void;
  transactionTitle?: string;
  transactionAmount?: number;
}

export default function CompleteTransactionButton({
  transactionId,
  transactionStatus,
  isUserBuyer,
  sellerHasStripeAccount = false,
  onTransferComplete,
  transactionTitle = 'Transaction',
  transactionAmount = 0
}: CompleteTransactionButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
      <Button
        onClick={() => setShowConfirmDialog(true)}
        disabled={isProcessing}
        className="w-full"
        size="lg"
      >
        <CheckCircle className="h-4 w-4 mr-2" />
        Finaliser la transaction
      </Button>

      <CompleteTransactionConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleCompleteTransaction}
        transactionTitle={transactionTitle}
        transactionAmount={transactionAmount}
        isProcessing={isProcessing}
      />
    </div>
  );
}