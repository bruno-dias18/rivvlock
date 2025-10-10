import { useState, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CreditCard, Clock, Download, Edit3, Calendar, Banknote, MessageCircle, MessageCircleMore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { useValidationStatus } from '@/hooks/useValidationStatus';
import { useIsMobile } from '@/lib/mobileUtils';
import { DateChangeRequestDialog } from '@/components/DateChangeRequestDialog';
import { DateChangeApprovalCard } from '@/components/DateChangeApprovalCard';
import { ExpiredPaymentNotification } from '@/components/ExpiredPaymentNotification';
import { RenewTransactionDialog } from '@/components/RenewTransactionDialog';
import { TransactionMessaging } from '@/components/TransactionMessaging';
import { useTranslation } from 'react-i18next';
import { getPublicBaseUrl } from '@/lib/appUrl';
import { useUnreadTransactionMessages } from '@/hooks/useUnreadTransactionMessages';
import { useHasTransactionMessages } from '@/hooks/useHasTransactionMessages';
import { logger } from '@/lib/logger';

interface TransactionCardProps {
  transaction: any;
  user: any;
  showActions?: boolean;
  hasNewActivity?: boolean;
  onCopyLink: (text: string) => void;
  onPayment: (transaction: any) => void;
  onRefetch: () => void;
  onOpenDispute: (transaction: any) => void;
  onDownloadInvoice: (transaction: any) => void;
  onDeleteExpired?: (transaction: any) => void;
  onRenewExpired?: (transaction: any, newServiceDate?: Date, message?: string) => void;
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
  
  // Map language to appropriate locale
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
  
  const getUserRole = (transaction: any) => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  };

  // Détection si la date de service est passée (ou la date de fin si elle existe)
  const isServiceDatePassed = () => {
    if (!transaction.service_date || transaction.status !== 'paid') {
      return false;
    }
    
    // Use service_end_date if it exists, otherwise service_date
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

  // Check if messaging is available
  const isMessagingAvailable = () => {
    const validStatuses = ['pending', 'paid'];
    const hasOtherParticipant = userRole === 'seller' ? !!transaction.buyer_id : !!transaction.user_id;
    return validStatuses.includes(transaction.status) && hasOtherParticipant;
  };

  return (
    <>
      {/* Date Change Approval Card - Show for buyers when there's a pending change */}
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
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
          <div className="flex-1">
            <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>{transaction.title}</CardTitle>
            <CardDescription className="mt-1">
              {transaction.description}
            </CardDescription>
          </div>
          <div className={`${isMobile ? 'flex justify-between items-center' : 'text-right ml-4'}`}>
            <div className="space-y-1">
              {/* Affichage du montant avec remboursement si applicable */}
              {transaction.status === 'validated' && transaction.refund_status !== 'none' && transaction.refund_status && (
                <div className="space-y-1">
                  {/* Prix original barré */}
                  <div className="text-sm text-muted-foreground line-through">
                    {transaction.price} {transaction.currency?.toUpperCase()}
                  </div>
                  
                  {/* Nouveau montant */}
                  <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
                    {transaction.refund_status === 'full' ? (
                      <>0 {transaction.currency?.toUpperCase()}</>
                    ) : (
                      <>
                        {userRole === 'seller' ? (
                          // Vendeur : montant net reçu après remboursement et frais RivvLock (5%)
                          (() => {
                            const refundAmount = transaction.price * ((transaction.refund_percentage || 0) / 100);
                            const amountAfterRefund = transaction.price - refundAmount;
                            const netAmount = amountAfterRefund * 0.95; // 5% de frais RivvLock
                            return `${netAmount.toFixed(2)} ${transaction.currency?.toUpperCase()}`;
                          })()
                        ) : (
                          // Acheteur : montant total payé (incluant frais RivvLock 5%)
                          (() => {
                            const refundAmount = transaction.price * ((transaction.refund_percentage || 0) / 100);
                            const amountAfterRefund = transaction.price - refundAmount;
                            const buyerFees = amountAfterRefund * 0.05; // 5% de frais RivvLock
                            const totalPaid = amountAfterRefund + buyerFees;
                            return `${totalPaid.toFixed(2)} ${transaction.currency?.toUpperCase()}`;
                          })()
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Badge de remboursement */}
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
              
              {/* Affichage normal si pas de remboursement */}
              {(!transaction.refund_status || transaction.refund_status === 'none' || transaction.status !== 'validated') && (
                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
                  {transaction.price} {transaction.currency?.toUpperCase()}
                </div>
              )}
            </div>
            <Badge variant="outline" className="mt-1">
              {userRole === 'seller' ? t('roles.seller') : t('roles.client')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Payment timing info for seller when transaction is validated */}
        {userRole === 'seller' && transaction.status === 'validated' && (
          <Alert className="mb-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {t('paymentTiming.sellerNote')}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div>{userRole === 'seller' ? t('roles.client') : t('roles.seller')}: {displayName}</div>
          <div>{t('transactions.createdOn')}: {new Date(transaction.created_at).toLocaleDateString(locale)}</div>
          {transaction.service_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {transaction.service_end_date ? (
                  <>
                    Du {new Date(transaction.service_date).toLocaleDateString(locale)} {t('transactions.at')} {new Date(transaction.service_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    {' au '}
                    {new Date(transaction.service_end_date).toLocaleDateString(locale)} {t('transactions.at')} {new Date(transaction.service_end_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </>
                ) : (
                  <>
                    {t('transactions.servicePlanned')}: {new Date(transaction.service_date).toLocaleDateString(locale)} {t('transactions.at')} {new Date(transaction.service_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </>
                )}
              </span>
              {transaction.date_change_status === 'pending_approval' && userRole === 'seller' && (
                <Badge variant="outline" className="text-orange-600 border-orange-300">
                  {t('transactions.modificationPending')}
                </Badge>
              )}
            </div>
          )}
          
          {/* Payment countdown for buyers on pending transactions */}
          {userRole === 'buyer' && transaction.status === 'pending' && transaction.payment_deadline && (
            <div className="mt-3">
              <PaymentCountdown paymentDeadline={transaction.payment_deadline} />
            </div>
          )}
          
          {/* Payment countdown for sellers on pending transactions */}
          {userRole === 'seller' && transaction.status === 'pending' && transaction.payment_deadline && (
            <Alert className="mt-3 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold text-orange-800 dark:text-orange-200">
                    {t('transactions.awaitingPayment')}
                  </div>
                  <PaymentCountdown paymentDeadline={transaction.payment_deadline} className="text-orange-700 dark:text-orange-300" />
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    {t('transactions.reminderSuggestion')}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Validation countdown for buyers during validation phase */}
          {userRole === 'buyer' && validationStatus.phase === 'validation_active' && transaction.validation_deadline && (
            <div className="mt-3">
              <ValidationCountdown validationDeadline={transaction.validation_deadline} />
            </div>
          )}
          
          {/* Validation countdown for sellers during buyer validation phase */}
          {userRole === 'seller' && validationStatus.phase === 'validation_active' && transaction.validation_deadline && (
            <div className="mt-3">
              <ValidationCountdown 
                validationDeadline={transaction.validation_deadline}
                isUserBuyer={false}
              />
            </div>
          )}
          
          {/* Expired payment notification */}
          {validationStatus.phase === 'expired' && (
            <div className="mt-3">
              <ExpiredPaymentNotification 
                userRole={userRole as 'seller' | 'buyer'} 
                onDelete={onDeleteExpired ? () => onDeleteExpired(transaction) : undefined}
                onRenew={onRenewExpired && userRole === 'seller' ? () => setIsRenewDialogOpen(true) : undefined}
              />
            </div>
          )}
          
          {/* Status indicator for other phases */}
          {validationStatus.phase === 'service_pending' && (
            <div className="mt-3 flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">{validationStatus.displayLabel}</span>
            </div>
          )}
          
          {/* Manual finalization for buyers during service pending */}
          {userRole === 'buyer' && validationStatus.canManuallyFinalize && validationStatus.phase !== 'validation_active' && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-2">
                {t('transactions.serviceDoneEarly')}
              </div>
              <CompleteButtonComponent
                transaction={transaction}
                onTransferComplete={onRefetch}
              />
            </div>
          )}
        </div>
        
        {showActions && (
          <div className={`flex gap-2 pt-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
            {userRole === 'seller' && transaction.status === 'pending' && (
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onCopyLink(`${getPublicBaseUrl()}/join/${transaction.shared_link_token}`)}
                className={isMobile ? "justify-center" : ""}
              >
                <Copy className="h-4 w-4 mr-2" />
                {isMobile ? t('common.copy') : t('common.copyLink')}
              </Button>
            )}
            
            {userRole === 'buyer' && transaction.status === 'pending' && (
              <Button
                size={isMobile ? "default" : "sm"}
                onClick={() => onPayment(transaction)}
                className={isMobile ? "justify-center" : ""}
                disabled={transaction.payment_deadline && new Date(transaction.payment_deadline) <= new Date()}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {transaction.payment_deadline && new Date(transaction.payment_deadline) <= new Date() 
                  ? t('transactions.deadlineExpired')
                  : (isMobile ? t('transactions.payAndBlockMobile') : t('transactions.payAndBlock'))
                }
              </Button>
            )}

            {userRole === 'seller' && transaction.status !== 'validated' && (
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setIsDateChangeDialogOpen(true)}
                className={isMobile ? "justify-center" : ""}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                {isMobile ? t('common.modifyDate') : t('common.modifyDate')}
              </Button>
            )}
            
            {transaction.status === 'paid' && userRole === 'buyer' && validationStatus.canFinalize && (
              <ValidationActionButtons
                transaction={transaction}
                isUserBuyer={true}
                onTransferComplete={() => onRefetch()}
                onOpenDispute={(tx) => onOpenDispute(tx)}
                isMobile={isMobile}
                isValidationExpired={validationStatus.phase === 'validation_expired'}
                CompleteButtonComponent={CompleteButtonComponent}
              />
            )}
            
            {transaction.status === 'paid' && userRole === 'buyer' && !validationStatus.canFinalize && validationStatus.phase !== 'validation_expired' && (
              <div className="text-sm text-muted-foreground">
                {validationStatus.displayLabel}
              </div>
            )}

            {isMessagingAvailable() && (
              <Button
                variant={unreadCount > 0 ? "default" : "outline"}
                size={isMobile ? "default" : "sm"}
                onClick={() => setIsMessagingOpen(true)}
                className={isMobile ? "justify-center" : ""}
              >
                {hasMessages ? (
                  <MessageCircleMore className="h-4 w-4 mr-2" />
                ) : (
                  <MessageCircle className="h-4 w-4 mr-2" />
                )}
                {hasMessages ? t('common.viewConversation', 'Voir la discussion') : t('common.contact', 'Contacter')}
                {unreadCount > 0 && (
                  <Badge className="ml-2 bg-primary-foreground text-primary">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            )}

            {transaction.status === 'validated' && (
              <Button 
                variant="outline" 
                size={isMobile ? "default" : "sm"}
                onClick={() => onDownloadInvoice(transaction)}
                className={isMobile ? "justify-center" : ""}
              >
                <Download className="h-4 w-4 mr-2" />
                {t('common.invoice')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
      </Card>

      {/* Date Change Request Dialog */}
      <DateChangeRequestDialog
        isOpen={isDateChangeDialogOpen}
        onClose={() => setIsDateChangeDialogOpen(false)}
        transactionId={transaction.id}
        currentDate={transaction.service_date}
        maxChangesReached={false}
        onSuccess={onRefetch}
      />

      {/* Renew Transaction Dialog */}
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

      {/* Transaction Messaging Dialog */}
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