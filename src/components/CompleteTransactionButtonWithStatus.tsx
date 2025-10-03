import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import CompleteTransactionButton from '@/components/CompleteTransactionButton';
import { useSellerStripeStatus } from '@/hooks/useSellerStripeStatus';
import { queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface CompleteTransactionButtonWithStatusProps {
  transaction: any;
  onTransferComplete: () => void;
}

export function CompleteTransactionButtonWithStatus({ 
  transaction, 
  onTransferComplete 
}: CompleteTransactionButtonWithStatusProps) {
  const { data: sellerStatus, isLoading, refetch } = useSellerStripeStatus(transaction.user_id);
  
  const handleRefresh = async () => {
    logger.debug('[CompleteTransactionButtonWithStatus] Manual refresh triggered');
    // Invalider le cache et refetch
    await queryClient.invalidateQueries({ queryKey: ['seller-stripe-status', transaction.user_id] });
    const result = await refetch();
    logger.debug('[CompleteTransactionButtonWithStatus] Refresh result:', result);
    toast.success('Statut du vendeur actualisé');
  };
  
  return (
    <div className="space-y-2">
      <CompleteTransactionButton
        transactionId={transaction.id}
        transactionStatus={transaction.status}
        isUserBuyer={true}
        sellerHasStripeAccount={sellerStatus?.hasActiveAccount || false}
        onTransferComplete={onTransferComplete}
        transactionTitle={transaction.title}
        transactionAmount={transaction.amount}
      />
      
      {!sellerStatus?.hasActiveAccount && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Rafraîchir le statut du vendeur
        </Button>
      )}
    </div>
  );
}
