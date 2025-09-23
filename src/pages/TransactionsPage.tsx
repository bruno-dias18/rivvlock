import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPublicBaseUrl } from '@/lib/appUrl';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, User, ShoppingCart } from 'lucide-react';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  interface PendingTransaction {
    id: string;
    title: string;
    price: number;
    currency: string;
    shared_link_token: string;
    user_id: string;
    buyer_id: string | null;
    status: string;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingTransaction[]>([]);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const baseUrl = useMemo(() => {
    return getPublicBaseUrl();
  }, []);

  useEffect(() => {
    if (user) {
      fetchPendingTransactions();
    }
  }, [user]);

  useEffect(() => {
    // Check if user just joined a transaction
    if (searchParams.get('joined') === 'success') {
      toast.success('Transaction jointe avec succès ! Vous pouvez maintenant procéder au paiement.');
      // Remove the parameter from URL
      setSearchParams({});
      // Refresh data
      if (user) {
        fetchPendingTransactions();
      }
    }
  }, [searchParams, setSearchParams, user]);

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('id, title, price, currency, shared_link_token, user_id, buyer_id, status')
        .or(`user_id.eq.${user!.id},buyer_id.eq.${user!.id}`)
        .eq('status', 'pending');

      if (error) throw error;
      setPending(data || []);
    } catch (err) {
      console.error('Error fetching pending transactions:', err);
      setError('Erreur lors du chargement des transactions');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Lien copié dans le presse-papier !');
  };

  const handlePayment = async (transaction: PendingTransaction) => {
    if (processingPayment) return;
    
    setProcessingPayment(transaction.id);
    try {
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-payment-checkout', {
        body: { 
          transactionId: transaction.id,
          transactionToken: transaction.shared_link_token
        }
      });

      if (checkoutError) throw checkoutError;
      if (checkoutData.error) throw new Error(checkoutData.error);

      // Redirect to Stripe checkout
      if (checkoutData.url || checkoutData.sessionUrl) {
        const stripeUrl = checkoutData.url || checkoutData.sessionUrl;
        window.open(stripeUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error processing payment:', err);
      toast.error(err.message || 'Erreur lors du traitement du paiement');
    } finally {
      setProcessingPayment(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.transactions')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.transactions')} - Gérez vos transactions d'escrow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('transactions.new')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fonctionnalité à implémenter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('transactions.pending')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune transaction en attente</p>
            ) : (
              <div className="space-y-4">
                {pending.map((transaction) => {
                  const isUserSeller = transaction.user_id === user?.id;
                  const isUserBuyer = transaction.buyer_id === user?.id;
                  
                  return (
                    <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{transaction.title}</h4>
                          {isUserSeller && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                              <User className="w-3 h-3" />
                              Vendeur
                            </span>
                          )}
                          {isUserBuyer && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              <ShoppingCart className="w-3 h-3" />
                              Acheteur
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {transaction.price} {transaction.currency}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isUserSeller && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`${baseUrl}/join-transaction/${transaction.shared_link_token}`)}
                          >
                            Copier le lien
                          </Button>
                        )}
                        {isUserBuyer && (
                          <Button
                            size="sm"
                            onClick={() => handlePayment(transaction)}
                            disabled={processingPayment === transaction.id}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {processingPayment === transaction.id ? 'Traitement...' : 'Bloquer l\'argent'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aucun historique disponible
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}