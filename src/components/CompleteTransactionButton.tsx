import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CompleteTransactionConfirmDialog } from '@/components/CompleteTransactionConfirmDialog';
import { logger } from '@/lib/logger';

interface CompleteTransactionButtonProps {
  transactionId: string;
  transactionStatus: string;
  isUserBuyer: boolean;
  sellerHasStripeAccount?: boolean;
  onTransferComplete?: () => void;
  transactionTitle?: string;
  transactionAmount?: number;
  transactionCurrency?: string;
}

export default function CompleteTransactionButton({
  transactionId,
  transactionStatus,
  isUserBuyer,
  sellerHasStripeAccount,
  onTransferComplete,
  transactionTitle = 'Transaction',
  transactionAmount = 0,
  transactionCurrency = 'EUR'
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
      setShowConfirmDialog(false);
      
      const { data, error } = await supabase.functions.invoke('release-funds', {
        body: { transactionId }
      });

      if (error) {
        logger.error('Edge function error:', error);
        throw new Error(error.message || 'Erreur lors de l\'appel à la fonction');
      }

      // Check if the response contains an error in the data
      if (data?.error) {
        logger.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      toast.success('Transaction finalisée ! Les fonds ont été transférés au vendeur.');
      
      if (onTransferComplete) {
        onTransferComplete();
      }
    } catch (error: any) {
      logger.error('Error processing transfer:', error);
      
      let errorMessage = 'Erreur lors du transfert des fonds';
      
      if (error.message) {
        // Check for common error patterns and provide clearer messages
        if (error.message.includes('not found') || error.message.includes('not authorized')) {
          errorMessage = 'Transaction non trouvée ou non autorisée';
        } else if (error.message.includes('Stripe account')) {
          errorMessage = 'Le compte bancaire du vendeur n\'est pas configuré correctement';
        } else if (error.message.includes('payment intent')) {
          errorMessage = 'Problème avec le paiement. Veuillez contacter le support.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const showWarning = sellerHasStripeAccount === false;

  return (
    <div className="space-y-3">
      {showWarning && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Attention: Le statut du compte bancaire semble non confirmé. La finalisation sera tentée avec vérification automatique.
          </AlertDescription>
        </Alert>
      )}
      <Button
        onClick={() => setShowConfirmDialog(true)}
        disabled={isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Finalisation...
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Finaliser la transaction
          </>
        )}
      </Button>

      <CompleteTransactionConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleCompleteTransaction}
        transactionTitle={transactionTitle}
        transactionAmount={transactionAmount}
        transactionCurrency={transactionCurrency}
        isProcessing={isProcessing}
      />
    </div>
  );
}