import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/lib/mobileUtils';
import type { Transaction } from '@/types';

interface TransactionPricingProps {
  transaction: Transaction;
  userRole: 'seller' | 'buyer' | null;
}

const TransactionPricingComponent = ({ transaction, userRole }: TransactionPricingProps) => {
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
                  // Seller: fees are taken first (5%), then the remainder is split
                  (() => {
                    const priceCents = Math.round(Number(transaction.price) * 100);
                    const feeCents = Math.round(priceCents * 5 / 100);
                    const baseCents = priceCents - feeCents; // amount to split
                    const r = Number(transaction.refund_percentage ?? 0); // buyer refund share in %
                    const sellerNetCents = Math.max(0, Math.floor(baseCents * (100 - r) / 100));
                    return `${(sellerNetCents / 100).toFixed(2)} ${transaction.currency?.toUpperCase()}`;
                  })()
                ) : (
                  // Buyer: total effectively paid after refund when fees are shared first
                  (() => {
                    const priceCents = Math.round(Number(transaction.price) * 100);
                    const feeCents = Math.round(priceCents * 5 / 100);
                    const baseCents = priceCents - feeCents; // amount to split
                    const r = Number(transaction.refund_percentage ?? 0); // buyer refund share in %
                    const buyerPaidCents = Math.max(0, Math.floor(baseCents * r / 100));
                    return `${(buyerPaidCents / 100).toFixed(2)} ${transaction.currency?.toUpperCase()}`;
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

export const TransactionPricing = memo(TransactionPricingComponent);
