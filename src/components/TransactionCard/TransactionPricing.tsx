import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/lib/mobileUtils';

interface TransactionPricingProps {
  transaction: any;
  userRole: 'seller' | 'buyer' | null;
}

export const TransactionPricing = ({ transaction, userRole }: TransactionPricingProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const hasRefund = transaction.status === 'validated' && 
    transaction.refund_status !== 'none' && 
    transaction.refund_status;

  return (
    <div className="space-y-1">
      {hasRefund && (
        <div className="space-y-1">
          {/* Original price crossed out */}
          <div className="text-sm text-muted-foreground line-through">
            {transaction.price} {transaction.currency?.toUpperCase()}
          </div>
          
          {/* New amount */}
          <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
            {transaction.refund_status === 'full' ? (
              <>0 {transaction.currency?.toUpperCase()}</>
            ) : (
              <>
                {userRole === 'seller' ? (
                  // Seller: net amount received after refund and RivvLock fees (5%)
                  (() => {
                    const refundAmount = transaction.price * ((transaction.refund_percentage || 0) / 100);
                    const amountAfterRefund = transaction.price - refundAmount;
                    const netAmount = amountAfterRefund * 0.95; // 5% RivvLock fees
                    return `${netAmount.toFixed(2)} ${transaction.currency?.toUpperCase()}`;
                  })()
                ) : (
                  // Buyer: total amount paid (including RivvLock fees 5%)
                  (() => {
                    const refundAmount = transaction.price * ((transaction.refund_percentage || 0) / 100);
                    const amountAfterRefund = transaction.price - refundAmount;
                    const buyerFees = amountAfterRefund * 0.05; // 5% RivvLock fees
                    const totalPaid = amountAfterRefund + buyerFees;
                    return `${totalPaid.toFixed(2)} ${transaction.currency?.toUpperCase()}`;
                  })()
                )}
              </>
            )}
          </div>
          
          {/* Refund badge */}
          <Badge 
            className={
              transaction.refund_status === 'full' 
                ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-200 dark:border-red-800' 
                : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-200 dark:border-orange-800'
            }
          >
            {transaction.refund_status === 'full' 
              ? t('disputes.fullRefund', 'Remboursement total')
              : `${t('disputes.partialRefund', 'Remboursement partiel')} (${transaction.refund_percentage}%)`
            }
          </Badge>
        </div>
      )}
      
      {/* Normal display if no refund */}
      {(!transaction.refund_status || transaction.refund_status === 'none' || transaction.status !== 'validated') && (
        <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
          {transaction.price} {transaction.currency?.toUpperCase()}
        </div>
      )}
    </div>
  );
};
