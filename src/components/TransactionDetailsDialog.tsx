import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, User, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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
  const { t } = useTranslation();

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

  const transactionData = transaction as any;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{transaction.title}</DialogTitle>
              <Badge className={getStatusColor(transaction.status)}>
                {t(`transactions.status.${transaction.status}`)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Counterparty Info */}
          <div>
            <h3 className="font-semibold mb-2">
              {userRole === 'seller' ? t('roles.client') : t('roles.seller')}
            </h3>
            <div className="text-sm space-y-1">
              <p><strong>{t('common.name', 'Nom')}:</strong> {displayName}</p>
              {transactionData.client_email && userRole === 'seller' && (
                <p><strong>Email:</strong> {transactionData.client_email}</p>
              )}
            </div>
          </div>

          {/* Description */}
          {transaction.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{transaction.description}</p>
            </div>
          )}

          <Separator />

          {/* Items - Always show if available */}
          <div>
            <h3 className="font-semibold mb-3">Détails de la prestation</h3>
            {transactionData.items && Array.isArray(transactionData.items) && transactionData.items.length > 0 ? (
              <div className="space-y-2">
                {transactionData.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantité: {item.quantity} × {item.unit_price.toFixed(2)} {transaction.currency.toUpperCase()}
                      </p>
                    </div>
                    <p className="font-semibold">{item.total.toFixed(2)} {transaction.currency.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="font-medium">{transaction.title}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Totals - Always show if items exist */}
          <div className="space-y-2">
            {transactionData.items && transactionData.items.length > 0 && transactionData.subtotal && (
              <div className="flex justify-between text-sm">
                <span>Sous-total:</span>
                <span>{transactionData.subtotal.toFixed(2)} {transaction.currency.toUpperCase()}</span>
              </div>
            )}
            
            {transactionData.discount_percentage && transactionData.discount_percentage > 0 && transactionData.subtotal && (
              <>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Rabais ({transactionData.discount_percentage}%):</span>
                  <span>-{(transactionData.subtotal * (transactionData.discount_percentage / 100)).toFixed(2)} {transaction.currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Sous-total après rabais:</span>
                  <span>{(transactionData.subtotal * (1 - transactionData.discount_percentage / 100)).toFixed(2)} {transaction.currency.toUpperCase()}</span>
                </div>
              </>
            )}
            
            {transactionData.tax_rate && transactionData.tax_rate > 0 && transactionData.tax_amount && (
              <div className="flex justify-between text-sm">
                <span>TVA ({transactionData.tax_rate}%):</span>
                <span>{transactionData.tax_amount.toFixed(2)} {transaction.currency.toUpperCase()}</span>
              </div>
            )}

            {transactionData.fee_ratio_client && transactionData.fee_ratio_client > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Frais de sécurisation ({transactionData.fee_ratio_client}%):</span>
                <span>
                  +{((transaction.price * transactionData.fee_ratio_client) / (100 + transactionData.fee_ratio_client)).toFixed(2)} {transaction.currency.toUpperCase()}
                </span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total TTC:</span>
              <span>{transaction.price.toFixed(2)} {transaction.currency.toUpperCase()}</span>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {transaction.service_date && (
              <div>
                <p className="font-semibold">Date de début:</p>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.service_date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
            {transaction.service_end_date && (
              <div>
                <p className="font-semibold">Date de fin:</p>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.service_end_date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
            {transaction.payment_deadline && (
              <div>
                <p className="font-semibold">{t('transactions.paymentDeadline', 'Échéance paiement')}:</p>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.payment_deadline), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
            )}
            {transaction.validation_deadline && (
              <div>
                <p className="font-semibold">{t('transactions.validationDeadline', 'Échéance validation')}:</p>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.validation_deadline), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </p>
              </div>
            )}
            <div>
              <p className="font-semibold">Créé le:</p>
              <p className="text-muted-foreground">
                {format(new Date(transaction.created_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
