import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, User, Package, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Transaction } from '@/types';

interface TransactionDetailsDialogProps {
  transaction: Transaction;
  userRole: 'seller' | 'buyer' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransactionDetailsDialog: React.FC<TransactionDetailsDialogProps> = ({
  transaction,
  userRole,
  open,
  onOpenChange,
}) => {
  const { t, i18n } = useTranslation();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'paid':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'validated':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'disputed':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const displayName = userRole === 'seller' 
    ? transaction.buyer_display_name || t('transactions.anonymousClient')
    : transaction.seller_display_name || t('common.seller');

  const transactionData = transaction as any; // Allow access to extended properties

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('transactions.details', 'Détails de la transaction')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{t('common.status')}:</span>
            <Badge className={getStatusColor(transaction.status)}>
              {t(`transactions.status.${transaction.status}`)}
            </Badge>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{transaction.title}</span>
            </div>
            {transaction.description && (
              <p className="text-sm text-muted-foreground pl-6">{transaction.description}</p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold">
              {transaction.price.toFixed(2)} {transaction.currency.toUpperCase()}
            </span>
            {transactionData.fee_ratio_client > 0 && (
              <Badge variant="outline" className="text-xs">
                +{transactionData.fee_ratio_client}% frais client
              </Badge>
            )}
          </div>

          {/* Items if present */}
          {transactionData.items && Array.isArray(transactionData.items) && transactionData.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">{t('quotes.items', 'Articles')}:</h4>
              <div className="border rounded-lg divide-y">
                {transactionData.items.map((item: any, index: number) => (
                  <div key={index} className="p-3 flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">{item.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {item.quantity} × {item.unit_price.toFixed(2)} {transaction.currency.toUpperCase()}
                      </div>
                    </div>
                    <div className="font-semibold">
                      {(item.quantity * item.unit_price).toFixed(2)} {transaction.currency.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Counterparty */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <span className="font-medium">
                {userRole === 'seller' ? t('roles.client') : t('roles.seller')}:
              </span>{' '}
              {displayName}
            </span>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{t('transactions.createdOn')}:</span>
              <span>{new Date(transaction.created_at).toLocaleDateString(locale)}</span>
            </div>

            {transaction.service_date && (
              <div className="flex items-center gap-2 text-sm pl-6">
                <span className="font-medium">{t('transactions.servicePlanned')}:</span>
                <span>
                  {transaction.service_end_date ? (
                    <>
                      Du {new Date(transaction.service_date).toLocaleDateString(locale)} {t('transactions.at')}{' '}
                      {new Date(transaction.service_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      {' au '}
                      {new Date(transaction.service_end_date).toLocaleDateString(locale)} {t('transactions.at')}{' '}
                      {new Date(transaction.service_end_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </>
                  ) : (
                    <>
                      {new Date(transaction.service_date).toLocaleDateString(locale)} {t('transactions.at')}{' '}
                      {new Date(transaction.service_date).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                </span>
              </div>
            )}

            {transaction.payment_deadline && (
              <div className="flex items-center gap-2 text-sm pl-6">
                <span className="font-medium">{t('transactions.paymentDeadline', 'Échéance paiement')}:</span>
                <span>
                  {new Date(transaction.payment_deadline).toLocaleDateString(locale)} {t('transactions.at')}{' '}
                  {new Date(transaction.payment_deadline).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {transaction.validation_deadline && (
              <div className="flex items-center gap-2 text-sm pl-6">
                <span className="font-medium">{t('transactions.validationDeadline', 'Échéance validation')}:</span>
                <span>
                  {new Date(transaction.validation_deadline).toLocaleDateString(locale)} {t('transactions.at')}{' '}
                  {new Date(transaction.validation_deadline).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>

          {/* Client email if available */}
          {transactionData.client_email && userRole === 'seller' && (
            <div className="text-sm">
              <span className="font-medium">{t('common.email')}:</span>{' '}
              <span className="text-muted-foreground">{transactionData.client_email}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
