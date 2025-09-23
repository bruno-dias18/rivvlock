import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TransactionData {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  seller_display_name: string;
  service_date: string;
}

export default function PaymentLinkPage() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }

    fetchTransaction();
  }, [token]);

  // Remove automatic payment trigger - let user click the button

  const fetchTransaction = async () => {
    try {
      console.log('🔍 [PaymentLink] Fetching transaction with token:', token);
      
      const functionUrl = `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-transaction-by-token?token=${encodeURIComponent(token || '')}`;
      const response = await fetch(functionUrl, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || 'anonymous'}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0'
        }
      });
      
      if (!response.ok) {
        console.error('🚨 [PaymentLink] HTTP error:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 [PaymentLink] Edge function response:', data);
      
      if (!data || !data.success) {
        console.error('🚨 [PaymentLink] Transaction fetch failed:', data?.error || 'No data received');
        setError(data?.error || 'Erreur lors de la récupération de la transaction');
      } else if (data.transaction) {
        console.log('✅ [PaymentLink] Transaction found:', data.transaction);
        setTransaction(data.transaction);
      } else {
        console.error('🚨 [PaymentLink] Transaction data missing from response');
        setError('Données de transaction manquantes');
      }
    } catch (err: any) {
      console.error('🚨 [PaymentLink] Error fetching transaction:', err);
      setError(`Erreur lors de la récupération de la transaction: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinAndPay = async () => {
    if (!user || !transaction || processingPayment) return;

    setProcessingPayment(true);
    try {
      // First, join the transaction
      const { data: joinData, error: joinError } = await supabase.functions.invoke('join-transaction', {
        body: { 
          transaction_id: transaction.id,
          linkToken: token 
        }
      });

      if (joinError) throw joinError;
      if (joinData.error) throw new Error(joinData.error);

      // Then create payment checkout
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-payment-checkout', {
        body: { 
          transactionId: transaction.id,
          token: token
        }
      });

      if (checkoutError) throw checkoutError;
      if (checkoutData.error) throw new Error(checkoutData.error);

      // Redirect to Stripe checkout
      if (checkoutData.url || checkoutData.sessionUrl) {
        const stripeUrl = checkoutData.url || checkoutData.sessionUrl;
        window.open(stripeUrl, '_blank');
        // Redirect user back to dashboard after opening payment
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Erreur lors du traitement du paiement');
    } finally {
      setProcessingPayment(false);
    }
  };

  // Show loading state while checking auth or fetching transaction
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Oups !</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => window.location.href = '/'}>
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  // If no user, redirect to auth with return URL
  if (!user) {
    const redirectUrl = `/payment-link/${token}`;
    return <Navigate to={`/auth?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  // Show transaction details and processing state
  if (transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <img 
              src="/assets/rivvlock-logo.jpeg" 
              alt="RIVVLOCK Logo" 
              className="mx-auto h-16 w-auto object-contain mb-6"
            />
          </div>

          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Paiement sécurisé</h1>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Service</label>
                <p className="font-semibold">{transaction.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{transaction.description}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Vendeur</label>
                <p className="font-medium">{transaction.seller_display_name}</p>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Total</span>
                <span className="text-2xl font-bold">
                  {transaction.price} {transaction.currency}
                </span>
              </div>
            </div>

            {processingPayment ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Préparation du paiement...
                </p>
              </div>
            ) : (
              <Button 
                onClick={handleJoinAndPay}
                className="w-full"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Bloquer l'argent
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Paiement sécurisé par Stripe • Vos données sont protégées
          </p>
        </div>
      </div>
    );
  }

  return null;
}