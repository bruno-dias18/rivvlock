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
  const { data: sellerStatus } = useSellerStripeStatus(transaction.user_id);
  
  return (
    <CompleteTransactionButton
      transactionId={transaction.id}
      transactionStatus={transaction.status}
      isUserBuyer={true}
      sellerHasStripeAccount={sellerStatus?.hasActiveAccount || false}
      onTransferComplete={onTransferComplete}
    />
  );
}