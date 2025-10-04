import { useState, memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CreditCard, CheckCircle2, Clock, Download, Edit3, Calendar, Banknote, MessageCircle, MessageCircleMore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { SellerValidationCountdown } from '@/components/SellerValidationCountdown';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { useValidationStatus } from '@/hooks/useValidationStatus';
import { useIsMobile } from '@/lib/mobileUtils';
import { DateChangeRequestDialog } from '@/components/DateChangeRequestDialog';
import { DateChangeApprovalCard } from '@/components/DateChangeApprovalCard';
import { ExpiredPaymentNotification } from '@/components/ExpiredPaymentNotification';
import { RenewTransactionDialog } from '@/components/RenewTransactionDialog';
import { TransactionMessaging } from '@/components/TransactionMessaging';
import { useTranslation } from 'react-i18next';
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
  const [isSellerValidating, setIsSellerValidating] = useState(false);
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

  const handleSellerValidation = async () => {
    setIsSellerValidating(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.functions.invoke('validate-seller', {
        body: { transactionId: transaction.id }
      });

      if (error) throw error;

      const { toast } = await import('sonner');
      toast.success(t('transactions.sellerValidationSuccess', 'Votre validation a été envoyée à l\'acheteur'));
      
      onRefetch();
    } catch (error) {
      logger.error('Error validating seller:', error);
      const { toast } = await import('sonner');
      toast.error(t('transactions.sellerValidationError', 'Impossible de valider la transaction'));
    } finally {
      setIsSellerValidating(false);
    }
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
            <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
              {transaction.price} {transaction.currency?.toUpperCase()}
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
          
          {/* Validation countdown for buyers during validation phase */}
          {userRole === 'buyer' && validationStatus.phase === 'validation_active' && transaction.validation_deadline && (
            <div className="mt-3">
              <ValidationCountdown validationDeadline={transaction.validation_deadline} />
            </div>
          )}
          
          {/* Alert for buyer when seller has validated */}
          {userRole === 'buyer' && transaction.status === 'paid' && transaction.seller_validated && !transaction.buyer_validated && validationStatus.phase === 'validation_active' && (
            <Alert className="mt-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <div className="font-semibold">{t('transactions.sellerHasValidated')}</div>
                <div className="text-sm mt-1">{t('transactions.buyerCanNowFinalize')}</div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Validation countdown for sellers during validation phase */}
          {userRole === 'seller' && validationStatus.phase === 'validation_active' && transaction.validation_deadline && (
            <div className="mt-3">
              <SellerValidationCountdown validationDeadline={transaction.validation_deadline} />
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
          {userRole === 'buyer' && validationStatus.canManuallyFinalize && (
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
                onClick={() => onCopyLink(`${window.location.origin}/join/${transaction.shared_link_token}`)}
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
            
            {transaction.status === 'paid' && userRole === 'seller' && !transaction.seller_validated && (
              <Button 
                variant="outline" 
                size={isMobile ? "default" : "sm"}
                className={isMobile ? "justify-center" : ""}
                onClick={handleSellerValidation}
                disabled={isSellerValidating}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {isSellerValidating ? t('common.loading', 'Chargement...') : t('common.validate')}
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