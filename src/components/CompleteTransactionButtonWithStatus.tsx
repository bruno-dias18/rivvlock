import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import CompleteTransactionButton from '@/components/CompleteTransactionButton';
import { useSellerStripeStatus } from '@/hooks/useSellerStripeStatus';

interface CompleteTransactionButtonWithStatusProps {
  transaction: any;
  onTransferComplete: () => void;
}

export function CompleteTransactionButtonWithStatus({ 
  transaction, 
  onTransferComplete 
}: CompleteTransactionButtonWithStatusProps) {
  const { data: sellerStatus, isLoading, refetch } = useSellerStripeStatus(transaction.user_id);
  
  return (
    <div className="space-y-2">
      {isLoading && (
        <div className="text-sm text-muted-foreground">
          Vérification du compte bancaire du vendeur...
        </div>
      )}
      
      <CompleteTransactionButton
        transactionId={transaction.id}
        transactionStatus={transaction.status}
        isUserBuyer={true}
        sellerHasStripeAccount={sellerStatus?.hasActiveAccount || false}
        onTransferComplete={onTransferComplete}
        transactionTitle={transaction.title}
        transactionAmount={transaction.amount}
      />
      
      {!sellerStatus?.hasActiveAccount && !isLoading && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Rafraîchir le statut du vendeur
        </Button>
      )}
    </div>
  );
}