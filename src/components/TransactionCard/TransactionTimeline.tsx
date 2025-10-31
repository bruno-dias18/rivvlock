import { memo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, Banknote, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { ExpiredPaymentNotification } from '@/components/ExpiredPaymentNotification';
import { DateChangeAcceptedNotification } from '@/components/DateChangeAcceptedNotification';
import { useTranslation } from 'react-i18next';
import { getDeadlineStatus } from '@/lib/deadlines';
import type { Transaction, ValidationStatus } from '@/types';

interface TransactionTimelineProps {
  transaction: Transaction;
  userRole: 'seller' | 'buyer' | null;
  displayName: string;
  locale: string;
  validationStatus: ValidationStatus;
  onDeleteExpired?: (transaction: Transaction) => void;
  setIsRenewDialogOpen: (open: boolean) => void;
  CompleteButtonComponent: React.ComponentType<any>;
  onRefetch: () => void;
}

const TransactionTimelineComponent = ({
  transaction,
  userRole,
  displayName,
  locale,
  validationStatus,
  onDeleteExpired,
  setIsRenewDialogOpen,
  CompleteButtonComponent,
  onRefetch
}: TransactionTimelineProps) => {
  const { t } = useTranslation();
  const deadlineStatus = getDeadlineStatus(transaction);

  return (
    <div className="space-y-2 text-sm text-muted-foreground mb-4" data-testid="transaction-timeline">
      {/* Date Change Accepted Notification for Seller */}
      {userRole === 'seller' && transaction.date_change_status === 'approved' && (
        <DateChangeAcceptedNotification transaction={transaction} />
      )}
      
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

      {/* Payment timing info for seller when validated */}
      {userRole === 'seller' && transaction.status === 'validated' && (
        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {t('paymentTiming.sellerNote')}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Payment countdown for buyers */}
      {userRole === 'buyer' && transaction.status === 'pending' && deadlineStatus.activeDeadline && (
        <div className="mt-3 space-y-2">
          {deadlineStatus.phase === 'card_active' && (
            <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-200 text-sm">
                Délai virement dépassé. Utilisez votre carte bancaire pour un paiement instantané.
              </AlertDescription>
            </Alert>
          )}
          <PaymentCountdown 
            paymentDeadline={deadlineStatus.activeDeadline.toISOString()} 
            label={deadlineStatus.phase === 'bank_active' ? 'Virement recommandé' : 'Dernier délai (carte)'}
          />
          {deadlineStatus.deadlines.bank && deadlineStatus.deadlines.card && (
            <div className="text-xs text-muted-foreground">
              Virement: {new Date(deadlineStatus.deadlines.bank).toLocaleDateString(locale)} · 
              Carte: {new Date(deadlineStatus.deadlines.card).toLocaleDateString(locale)}
            </div>
          )}
        </div>
      )}
      
      {/* Payment countdown for sellers */}
      {userRole === 'seller' && transaction.status === 'pending' && deadlineStatus.activeDeadline && (
        <Alert className="mt-3 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-semibold text-orange-800 dark:text-orange-200">
                {t('transactions.awaitingPayment')}
              </div>
              {deadlineStatus.phase === 'card_active' && (
                <div className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                  ⚠️ Délai virement dépassé - paiement par carte uniquement
                </div>
              )}
              <PaymentCountdown 
                paymentDeadline={deadlineStatus.activeDeadline.toISOString()} 
                className="text-orange-700 dark:text-orange-300"
                label={deadlineStatus.phase === 'bank_active' ? 'Virement recommandé' : 'Dernier délai (carte)'}
              />
              {deadlineStatus.deadlines.bank && deadlineStatus.deadlines.card && (
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  Virement: {new Date(deadlineStatus.deadlines.bank).toLocaleDateString(locale)} · 
                  Carte: {new Date(deadlineStatus.deadlines.card).toLocaleDateString(locale)}
                </div>
              )}
              <div className="text-sm text-orange-700 dark:text-orange-300">
                {t('transactions.reminderSuggestion')}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Validation countdown for buyers */}
      {userRole === 'buyer' && validationStatus.phase === 'validation_active' && transaction.validation_deadline && (
        <div className="mt-3">
          <ValidationCountdown validationDeadline={transaction.validation_deadline} />
        </div>
      )}
      
      {/* Validation countdown for sellers */}
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
            onRenew={setIsRenewDialogOpen && userRole === 'seller' ? () => setIsRenewDialogOpen(true) : undefined}
          />
        </div>
      )}
      
      {/* Status indicator for service pending */}
      {validationStatus.phase === 'service_pending' && (
        <div className="mt-3 flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="text-sm">{validationStatus.displayLabel}</span>
        </div>
      )}
      
      {/* Status indicator for validation expired */}
      {validationStatus.phase === 'validation_expired' && (
        <Alert data-testid="validation-expired" className="mt-3 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            <div className="space-y-2">
              <div data-testid="validation-expired-title" className="font-semibold">
                Délai de validation expiré
              </div>
              <div data-testid="validation-expired-info" className="text-sm">
                Les fonds seront libérés automatiquement au vendeur après traitement.
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {/* Manual finalization for buyers */}
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
  );
};

export const TransactionTimeline = memo(TransactionTimelineComponent);
