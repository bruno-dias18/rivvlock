import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, CreditCard, Edit3, Download, MessageCircle, MessageCircleMore } from 'lucide-react';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/lib/mobileUtils';
import { getPublicBaseUrl } from '@/lib/appUrl';
import type { Transaction, ValidationStatus } from '@/types';

interface TransactionActionsProps {
  transaction: Transaction;
  userRole: 'seller' | 'buyer' | null;
  validationStatus: ValidationStatus;
  unreadCount: number;
  hasMessages: boolean;
  isMessagingAvailable: boolean;
  onCopyLink: (text: string) => void;
  onPayment: (transaction: Transaction) => void;
  setIsDateChangeDialogOpen: (open: boolean) => void;
  setIsMessagingOpen: (open: boolean) => void;
  onDownloadInvoice: (transaction: Transaction) => void;
  onRefetch: () => void;
  onOpenDispute: (transaction: Transaction) => void;
  CompleteButtonComponent: React.ComponentType<any>;
}

export const TransactionActions = ({
  transaction,
  userRole,
  validationStatus,
  unreadCount,
  hasMessages,
  isMessagingAvailable,
  onCopyLink,
  onPayment,
  setIsDateChangeDialogOpen,
  setIsMessagingOpen,
  onDownloadInvoice,
  onRefetch,
  onOpenDispute,
  CompleteButtonComponent
}: TransactionActionsProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div className={`flex gap-2 pt-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
      {/* Seller copy link */}
      {userRole === 'seller' && transaction.status === 'pending' && (
        <Button
          variant="outline"
          size={isMobile ? "default" : "sm"}
          onClick={() => onCopyLink(`${getPublicBaseUrl()}/join/${transaction.shared_link_token}`)}
          className={`${isMobile ? "justify-center" : ""} transition-all duration-200 hover:scale-105 active:scale-95`}
        >
          <Copy className="h-4 w-4 mr-2" />
          {isMobile ? t('common.copy') : t('common.copyLink')}
        </Button>
      )}
      
      {/* Buyer payment */}
      {userRole === 'buyer' && transaction.status === 'pending' && (
        <Button
          size={isMobile ? "default" : "sm"}
          onClick={() => onPayment(transaction)}
          className={`${isMobile ? "justify-center" : ""} transition-all duration-200 hover:scale-105 active:scale-95`}
          disabled={transaction.payment_deadline && new Date(transaction.payment_deadline) <= new Date()}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {transaction.payment_deadline && new Date(transaction.payment_deadline) <= new Date() 
            ? t('transactions.deadlineExpired')
            : (isMobile ? t('transactions.payAndBlockMobile') : t('transactions.payAndBlock'))
          }
        </Button>
      )}

      {/* Seller propose/modify date */}
      {userRole === 'seller' && transaction.status !== 'validated' && (
        <Button
          variant="outline"
          size={isMobile ? "default" : "sm"}
          onClick={() => setIsDateChangeDialogOpen(true)}
          className={`${isMobile ? "justify-center" : ""} transition-all duration-200 hover:scale-105 active:scale-95`}
        >
          <Edit3 className="h-4 w-4 mr-2" />
          {transaction.service_date 
            ? (isMobile ? t('common.modifyDate') : t('common.modifyDate'))
            : (isMobile ? t('common.proposeDate', 'Proposer date') : t('common.proposeDate', 'Proposer une date'))
          }
        </Button>
      )}
      
      {/* Buyer validation actions */}
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
      
      {/* Buyer validation phase message */}
      {transaction.status === 'paid' && userRole === 'buyer' && !validationStatus.canFinalize && validationStatus.phase !== 'validation_expired' && (
        <div className="text-sm text-muted-foreground">
          {validationStatus.displayLabel}
        </div>
      )}

      {/* Messaging button */}
      {isMessagingAvailable && (
        <Button
          variant={unreadCount > 0 ? "default" : "outline"}
          size={isMobile ? "default" : "sm"}
          onClick={() => setIsMessagingOpen(true)}
          className={`${isMobile ? "justify-center" : ""} transition-all duration-200 hover:scale-105 active:scale-95`}
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

      {/* Download invoice */}
      {transaction.status === 'validated' && (
        <Button 
          variant="outline" 
          size={isMobile ? "default" : "sm"}
          onClick={() => onDownloadInvoice(transaction)}
          className={`${isMobile ? "justify-center" : ""} transition-all duration-200 hover:scale-105 active:scale-95`}
        >
          <Download className="h-4 w-4 mr-2" />
          {t('common.invoice')}
        </Button>
      )}
    </div>
  );
};
