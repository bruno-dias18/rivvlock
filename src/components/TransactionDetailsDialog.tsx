import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Transaction } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { getPublicBaseUrl } from '@/lib/appUrl';
import { toast } from 'sonner';

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

  const [quoteDetails, setQuoteDetails] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('items, subtotal, tax_rate, tax_amount, discount_percentage, fee_ratio_client')
        .eq('converted_transaction_id', transaction.id)
        .maybeSingle();

      if (!error && data) {
        setQuoteDetails(data);
      } else {
        setQuoteDetails(null);
      }
    })();
  }, [open, transaction.id]);

  const displayName = userRole === 'seller' 
    ? transaction.buyer_display_name || t('transactions.anonymousClient')
    : transaction.seller_display_name || t('common.seller');

  const transactionData = transaction as any;

  // Prefer transaction items; fallback to linked quote items; else create virtual
  const hasDetailedItems = transactionData.items && Array.isArray(transactionData.items) && transactionData.items.length > 0;
  const hasQuoteItems = !hasDetailedItems && quoteDetails?.items && Array.isArray(quoteDetails.items) && quoteDetails.items.length > 0;
  
  const displayItems = hasDetailedItems
    ? transactionData.items
    : hasQuoteItems
      ? quoteDetails.items
      : [{
          description: transaction.title,
          quantity: 1,
          unit_price: transaction.price / (1 + ((transactionData.fee_ratio_client || quoteDetails?.fee_ratio_client || 0) / 100)),
          total: transaction.price / (1 + ((transactionData.fee_ratio_client || quoteDetails?.fee_ratio_client || 0) / 100))
        }];
  
  // Calculate subtotal from items
  const calculatedSubtotal = displayItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
  const discountPercentage = (hasQuoteItems && (quoteDetails?.discount_percentage ?? null) !== null)
    ? quoteDetails!.discount_percentage
    : (transactionData.discount_percentage || 0);
  const subtotalAfterDiscount = calculatedSubtotal * (1 - (discountPercentage || 0) / 100);
  const clientFeeRatio = (hasQuoteItems && (quoteDetails?.fee_ratio_client ?? null) !== null)
    ? quoteDetails!.fee_ratio_client
    : (transactionData.fee_ratio_client || 0);
  const clientFees = clientFeeRatio > 0 ? (transaction.price * clientFeeRatio) / (100 + clientFeeRatio) : 0;
  const taxRate = (hasQuoteItems && (quoteDetails?.tax_rate ?? null) !== null)
    ? quoteDetails!.tax_rate
    : transactionData.tax_rate;
  const taxAmount = (hasQuoteItems && (quoteDetails?.tax_amount ?? null) !== null)
    ? quoteDetails!.tax_amount
    : transactionData.tax_amount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-xl">{transaction.title}</DialogTitle>
            <Badge className={getStatusColor(transaction.status)}>
              {t(`transactions.${transaction.status}`, transaction.status)}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Counterparty Info & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <Separator />

          {/* Items - Always show */}
          <div>
            <h3 className="font-semibold mb-3">Détails de la prestation</h3>
            <div className="space-y-2">
              {displayItems.map((item: any, idx: number) => (
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
          </div>

          <Separator />

          {/* Totals - Always show complete breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sous-total:</span>
              <span>{calculatedSubtotal.toFixed(2)} {transaction.currency.toUpperCase()}</span>
            </div>
            
            {discountPercentage > 0 ? (
              <>
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Rabais ({discountPercentage}%):</span>
                  <span>-{(calculatedSubtotal * (discountPercentage / 100)).toFixed(2)} {transaction.currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span>Sous-total après rabais:</span>
                  <span>{subtotalAfterDiscount.toFixed(2)} {transaction.currency.toUpperCase()}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Rabais (0%):</span>
                <span>-0.00 {transaction.currency.toUpperCase()}</span>
              </div>
            )}
            
            {taxRate && taxRate > 0 && taxAmount && (
              <div className="flex justify-between text-sm">
                <span>TVA ({taxRate}%):</span>
                <span>{taxAmount.toFixed(2)} {transaction.currency.toUpperCase()}</span>
              </div>
            )}

            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total TTC:</span>
              <span>{transaction.price.toFixed(2)} {transaction.currency.toUpperCase()}</span>
            </div>
          </div>

          <Separator />

          {/* Share Link - Seller only when pending */}
          {userRole === 'seller' && transaction.status === 'pending' && (
            <>
              <div>
                <h3 className="font-semibold mb-2">Lien client</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${getPublicBaseUrl()}/join/${transaction.shared_link_token}`}
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted break-all"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      navigator.clipboard.writeText(`${getPublicBaseUrl()}/join/${transaction.shared_link_token}`);
                      toast.success('Lien copié dans le presse-papier');
                    }}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copier
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Ce lien permet au client de rejoindre la transaction
                </p>
              </div>
              <Separator />
            </>
          )}

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
