import { useState, memo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useValidationStatus } from '@/hooks/useValidationStatus';
import { useIsMobile } from '@/lib/mobileUtils';
import { DateChangeRequestDialog } from '@/components/DateChangeRequestDialog';
import { DateChangeApprovalCard } from '@/components/DateChangeApprovalCard';
import { RenewTransactionDialog } from '@/components/RenewTransactionDialog';
import { TransactionMessaging } from '@/components/TransactionMessaging';
import { useTranslation } from 'react-i18next';
import { useUnreadTransactionMessages } from '@/hooks/useUnreadTransactionMessages';
import { useHasTransactionMessages } from '@/hooks/useHasTransactionMessages';
import { TransactionHeader } from './TransactionCard/TransactionHeader';
import { TransactionPricing } from './TransactionCard/TransactionPricing';
import { TransactionTimeline } from './TransactionCard/TransactionTimeline';
import { TransactionActions } from './TransactionCard/TransactionActions';
import type { Transaction } from '@/types';

interface TransactionCardProps {
  transaction: Transaction;
  user: { id: string } | null;
  showActions?: boolean;
  hasNewActivity?: boolean;
  onCopyLink: (text: string) => void;
  onPayment: (transaction: Transaction) => void;
  onRefetch: () => void;
  onOpenDispute: (transaction: Transaction) => void;
  onDownloadInvoice: (transaction: Transaction) => void;
  onDeleteExpired?: (transaction: Transaction) => void;
  onRenewExpired?: (transaction: Transaction, newServiceDate?: Date, message?: string) => void;
  CompleteButtonComponent: React.ComponentType<any>;
}

const TransactionCardComponent = ({
  transaction,
  user,
  showActions = true,
  hasNewActivity = false,
  onCopyLink,
  onPayment,
  onRefetch,
  onOpenDispute,
  onDownloadInvoice,
  onDeleteExpired,
  onRenewExpired,
  CompleteButtonComponent
}: TransactionCardProps) => {
  const isMobile = useIsMobile();
  const validationStatus = useValidationStatus(transaction, user?.id);
  const [isDateChangeDialogOpen, setIsDateChangeDialogOpen] = useState(false);
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [isMessagingOpen, setIsMessagingOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const { unreadCount } = useUnreadTransactionMessages(transaction.id);
  const hasMessages = useHasTransactionMessages(transaction.id);
  
  const getLocale = () => {
    switch (i18n.language) {
      case 'de':
        return 'de-DE';
      case 'en':
        return 'en-US';
      default:
        return 'fr-FR';
    }
  };
  
  const locale = getLocale();
  
  const getUserRole = (transaction: Transaction): 'seller' | 'buyer' | null => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  };

  const isServiceDatePassed = () => {
    if (!transaction.service_date || transaction.status !== 'paid') {
      return false;
    }
    
    const referenceDate = new Date(transaction.service_end_date || transaction.service_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    referenceDate.setHours(0, 0, 0, 0);
    
    return referenceDate < today;
  };

  const userRole = getUserRole(transaction);
  const displayName = userRole === 'seller' 
    ? transaction.buyer_display_name || t('transactions.anonymousClient')
    : transaction.seller_display_name || t('common.seller');

  const isMessagingAvailable = () => {
    const validStatuses = ['pending', 'paid'];
    const hasOtherParticipant = userRole === 'seller' ? !!transaction.buyer_id : !!transaction.user_id;
    return validStatuses.includes(transaction.status) && hasOtherParticipant;
  };

  return (
    <>
      {/* Date Change Approval Card */}
      {userRole === 'buyer' && transaction.date_change_status === 'pending_approval' && (
        <div className="mb-4">
          <DateChangeApprovalCard transaction={transaction} onResponse={onRefetch} />
        </div>
      )}

      <Card key={transaction.id} className={cn(
        "mb-4 relative",
        isServiceDatePassed() && "border-2 border-orange-400",
        hasNewActivity && "border-2 border-blue-500 dark:border-blue-400"
      )}>
        {hasNewActivity && (
          <Badge className="absolute -top-2 -right-2 bg-blue-500 hover:bg-blue-500 text-white shadow-lg z-10">
            {t('transactions.newActivity')}
          </Badge>
        )}
        
        <CardHeader className="pb-3">
          <TransactionHeader 
            title={transaction.title}
            description={transaction.description}
            userRole={userRole}
          />
          <div className={`${isMobile ? 'mt-3' : 'absolute top-6 right-6'}`}>
            <TransactionPricing 
              transaction={transaction}
              userRole={userRole}
            />
          </div>
        </CardHeader>
        
        <CardContent>
          <TransactionTimeline
            transaction={transaction}
            userRole={userRole}
            displayName={displayName}
            locale={locale}
            validationStatus={validationStatus}
            onDeleteExpired={onDeleteExpired}
            setIsRenewDialogOpen={setIsRenewDialogOpen}
            CompleteButtonComponent={CompleteButtonComponent}
            onRefetch={onRefetch}
          />
          
          {showActions && (
            <TransactionActions
              transaction={transaction}
              userRole={userRole}
              validationStatus={validationStatus}
              unreadCount={unreadCount}
              hasMessages={hasMessages}
              isMessagingAvailable={isMessagingAvailable()}
              onCopyLink={onCopyLink}
              onPayment={onPayment}
              setIsDateChangeDialogOpen={setIsDateChangeDialogOpen}
              setIsMessagingOpen={setIsMessagingOpen}
              onDownloadInvoice={onDownloadInvoice}
              onRefetch={onRefetch}
              onOpenDispute={onOpenDispute}
              CompleteButtonComponent={CompleteButtonComponent}
            />
          )}
        </CardContent>
      </Card>

      <DateChangeRequestDialog
        isOpen={isDateChangeDialogOpen}
        onClose={() => setIsDateChangeDialogOpen(false)}
        transactionId={transaction.id}
        currentDate={transaction.service_date}
        maxChangesReached={false}
        onSuccess={onRefetch}
      />

      {onRenewExpired && (
        <RenewTransactionDialog
          open={isRenewDialogOpen}
          onOpenChange={setIsRenewDialogOpen}
          onConfirm={(newServiceDate, message) => {
            onRenewExpired(transaction, newServiceDate, message);
            setIsRenewDialogOpen(false);
          }}
        />
      )}

      <TransactionMessaging
        transactionId={transaction.id}
        open={isMessagingOpen}
        onOpenChange={setIsMessagingOpen}
        otherParticipantName={displayName}
      />
    </>
  );
};

export const TransactionCard = memo(TransactionCardComponent);
