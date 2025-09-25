import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, CreditCard, CheckCircle2, Clock, Download, Edit3, Calendar } from 'lucide-react';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { useValidationStatus } from '@/hooks/useValidationStatus';
import { useIsMobile } from '@/lib/mobileUtils';
import { DateChangeRequestDialog } from '@/components/DateChangeRequestDialog';
import { DateChangeApprovalCard } from '@/components/DateChangeApprovalCard';
import { useTranslation } from 'react-i18next';

interface TransactionCardProps {
  transaction: any;
  user: any;
  showActions?: boolean;
  onCopyLink: (text: string) => void;
  onPayment: (transaction: any) => void;
  onRefetch: () => void;
  onOpenDispute: (transaction: any) => void;
  onDownloadInvoice: (transaction: any) => void;
  CompleteButtonComponent: React.ComponentType<any>;
}

export function TransactionCard({
  transaction,
  user,
  showActions = true,
  onCopyLink,
  onPayment,
  onRefetch,
  onOpenDispute,
  onDownloadInvoice,
  CompleteButtonComponent
}: TransactionCardProps) {
  const isMobile = useIsMobile();
  const validationStatus = useValidationStatus(transaction, user?.id);
  const [isDateChangeDialogOpen, setIsDateChangeDialogOpen] = useState(false);
  const { t } = useTranslation();
  
  const getUserRole = (transaction: any) => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  };

  const userRole = getUserRole(transaction);
  const displayName = userRole === 'seller' 
    ? transaction.buyer_display_name || t('transactions.anonymousClient')
    : transaction.seller_display_name || t('common.seller');

  return (
    <>
      {/* Date Change Approval Card - Show for buyers when there's a pending change */}
      {userRole === 'buyer' && transaction.date_change_status === 'pending_approval' && (
        <div className="mb-4">
          <DateChangeApprovalCard transaction={transaction} onResponse={onRefetch} />
        </div>
      )}

      <Card key={transaction.id} className="mb-4">
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
        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div>{userRole === 'seller' ? t('roles.client') : t('roles.seller')}: {displayName}</div>
          <div>{t('transactions.createdOn')}: {new Date(transaction.created_at).toLocaleDateString('fr-FR')}</div>
          {transaction.service_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{t('transactions.servicePlanned')}: {new Date(transaction.service_date).toLocaleDateString('fr-FR')} à {new Date(transaction.service_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
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
            
            {transaction.status === 'paid' && userRole === 'seller' && (
              <Button 
                variant="outline" 
                size={isMobile ? "default" : "sm"}
                className={isMobile ? "justify-center" : ""}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('common.validate')}
              </Button>
            )}

            {userRole === 'seller' && (
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => setIsDateChangeDialogOpen(true)}
                className={isMobile ? "justify-center" : ""}
                disabled={transaction.date_change_count >= 2}
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

            {transaction.status === 'validated' && (
              <Button 
                variant="outline" 
                size={isMobile ? "default" : "sm"}
                onClick={() => onDownloadInvoice(transaction)}
                className={isMobile ? "justify-center" : ""}
              >
                <Download className="h-4 w-4 mr-2" />
                {isMobile ? t('common.invoice') : t('transactions.downloadInvoice')}
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
        maxChangesReached={transaction.date_change_count >= 2}
        onSuccess={onRefetch}
      />
    </>
  );
}