import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { TransactionCard } from './TransactionCard';
import { LocalErrorBoundary } from './LocalErrorBoundary';
import type { Transaction } from '@/types';

/**
 * Virtual scrolling wrapper for transaction lists
 * Renders only visible items for optimal performance with large datasets
 * 
 * @param transactions - Array of transactions to display
 * @param user - Current authenticated user
 * @param transactionsWithNewActivity - Set of transaction IDs with new activity
 * @param onCopyLink - Handler for copying transaction links
 * @param onPayment - Handler for payment actions
 * @param onRefetch - Handler to refetch transactions
 * @param onOpenDispute - Handler to open dispute dialog
 * @param onDownloadInvoice - Handler to download invoice
 * @param onDeleteExpired - Handler to delete expired transactions
 * @param onRenewExpired - Handler to renew expired transactions
 * @param CompleteButtonComponent - Component for complete transaction button
 */
interface VirtualTransactionListProps {
  transactions: Transaction[];
  user: any;
  transactionsWithNewActivity?: Set<string>;
  onCopyLink: (text: string) => void;
  onPayment: (transaction: Transaction) => void;
  onRefetch: () => void;
  onOpenDispute: (transaction: Transaction) => void;
  onDownloadInvoice: (transaction: Transaction) => void;
  onDeleteExpired?: (transaction: Transaction) => void;
  onRenewExpired?: (transaction: Transaction, newServiceDate?: Date, message?: string) => void;
  CompleteButtonComponent: React.ComponentType<any>;
}

export const VirtualTransactionList: React.FC<VirtualTransactionListProps> = ({
  transactions,
  user,
  transactionsWithNewActivity,
  onCopyLink,
  onPayment,
  onRefetch,
  onOpenDispute,
  onDownloadInvoice,
  onDeleteExpired,
  onRenewExpired,
  CompleteButtonComponent,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create virtualizer instance
  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated height of TransactionCard
    overscan: 3, // Render 3 extra items above and below viewport
  });

  return (
    <LocalErrorBoundary onRetry={onRefetch}>
      <div
        ref={parentRef}
        style={{
          height: '600px',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const transaction = transactions[virtualItem.index];
            
            return (
              <div
                key={transaction.id}
                id={`transaction-${transaction.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="transition-all duration-300 px-1 py-2"
              >
                <TransactionCard
                  transaction={transaction}
                  user={user}
                  showActions={true}
                  hasNewActivity={transactionsWithNewActivity?.has(transaction.id)}
                  onCopyLink={onCopyLink}
                  onPayment={onPayment}
                  onRefetch={onRefetch}
                  onOpenDispute={onOpenDispute}
                  onDownloadInvoice={onDownloadInvoice}
                  onDeleteExpired={onDeleteExpired}
                  onRenewExpired={onRenewExpired}
                  CompleteButtonComponent={CompleteButtonComponent}
                />
              </div>
            );
          })}
        </div>
      </div>
    </LocalErrorBoundary>
  );
};
