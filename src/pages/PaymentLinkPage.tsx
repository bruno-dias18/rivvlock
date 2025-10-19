import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CreditCard, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { BankTransferInstructions } from '@/components/BankTransferInstructions';
import { Transaction } from '@/types';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface TransactionData {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  seller_display_name: string;
  service_date: string;
  payment_deadline?: string;
  status?: string;
  payment_method?: 'card' | 'bank_transfer';
}

export default function PaymentLinkPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [debugMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get('debug') === '1');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'bank_transfer' | null>(null);
  const [showBankInstructions, setShowBankInstructions] = useState(false);

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
      // Support both URL token and query param txId for existing links
      const searchParams = new URLSearchParams(window.location.search);
      const txId = searchParams.get('txId');
      const finalToken = token || txId;
      
      if (!finalToken) {
        throw new Error('No transaction token found in URL or query params');
      }
      
      let payload: any | null = null;

      // 1) Primary path: Supabase SDK (POST)
      try {
        const { data, error } = await supabase.functions.invoke('get-transaction-by-token', {
          body: { token: finalToken }
        });
        if (error) throw error;
        payload = data;
      } catch (primaryErr: any) {
        // 2) Fallback path: direct GET with full URL (supports public functions)
        // Note: We include anon key headers as recommended for direct calls
        const endpoint = `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-transaction-by-token?token=${encodeURIComponent(finalToken)}`;
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0',
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0'
          }
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const reason = json?.error || json?.message || primaryErr?.message || 'Edge Function non disponible';
          throw new Error(reason);
        }
        payload = json;
      }

      // Accept either { success: true, transaction } or just { transaction }
      const data = payload || {};

      if (data.transaction) {
        // Vérifier si la deadline est passée
        if (data.transaction.payment_deadline) {
          const deadline = new Date(data.transaction.payment_deadline);
          if (deadline < new Date()) {
            setError('Cette transaction a expiré. Le délai de paiement est dépassé.');
            setTransaction(null);
            setLoading(false);
            return;
          }
        }
        setTransaction(data.transaction);
      } else {
        setError(data?.error || 'Erreur lors de la récupération de la transaction');
      }
    } catch (err: any) {
      setError(`Erreur lors de la récupération de la transaction: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async () => {
    if (!user || !transaction || processingPayment) return;

    // If bank transfer is selected, mark transaction method and show instructions
    if (selectedPaymentMethod === 'bank_transfer') {
      try {
        // Update transaction with bank_transfer payment method
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ payment_method: 'bank_transfer' })
          .eq('id', transaction.id);

        if (updateError) throw updateError;

        setShowBankInstructions(true);
      } catch (err: any) {
        logger.error('Error updating payment method:', err);
        setError(err.message || 'Erreur lors de la sélection du mode de paiement');
      }
      return;
    }

    setProcessingPayment(true);
    try {
      // 1. Join the transaction first
      const { data: joinData, error: joinError } = await supabase.functions.invoke('join-transaction', {
        body: { 
          transaction_id: transaction.id,
          linkToken: token || new URLSearchParams(window.location.search).get('txId')
        }
      });

      if (joinError) throw joinError;
      if (joinData.error) throw new Error(joinData.error);

      // 2. Create Stripe Checkout session immediately
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-payment-checkout', {
        body: { 
          transactionId: transaction.id,
          transactionToken: token || new URLSearchParams(window.location.search).get('txId'),
          payment_method: selectedPaymentMethod
        }
      });

      if (checkoutError) throw checkoutError;
      if (checkoutData.error) throw new Error(checkoutData.error);

      // 3. Redirect to Stripe Checkout
      if (checkoutData.url || checkoutData.sessionUrl) {
        window.location.href = checkoutData.url || checkoutData.sessionUrl;
      } else {
        throw new Error('URL de paiement manquante');
      }
    } catch (err: any) {
      logger.error('Error initiating payment:', err);
      setError(err.message || 'Erreur lors de la préparation du paiement');
      setProcessingPayment(false);
    }
  };

  const handleAuthRedirect = () => {
    const redirectUrl = `/payment-link/${token || new URLSearchParams(window.location.search).get('txId')}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
  };

  // Show loading state while checking auth or fetching transaction
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {debugMode && (
          <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
            DEBUG: token={token} | txId={new URLSearchParams(window.location.search).get('txId')} | authenticated={String(!!user)} | authLoading={String(authLoading)}
          </div>
        )}
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
        {debugMode && (
          <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
            DEBUG: token={token} | txId={new URLSearchParams(window.location.search).get('txId')} | authenticated={String(!!user)} | error={error}
          </div>
        )}
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

  // If no user and we have transaction data, show join transaction screen
  if (!user && transaction) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {debugMode && (
          <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
            DEBUG: token={token} | txId={new URLSearchParams(window.location.search).get('txId')} | authenticated=false
          </div>
        )}
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <img 
              src="/assets/rivvlock-logo.jpeg" 
              alt="RIVVLOCK Logo" 
              className="mx-auto h-16 w-auto object-contain mb-6"
              loading="lazy"
            />
          </div>

          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Transaction disponible</h1>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Service</label>
                <p className="font-semibold">{transaction.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{transaction.description}</p>
              </div>
              
              {transaction.service_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date du service</label>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(transaction.service_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
              
              {transaction.payment_deadline && (
                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                  <PaymentCountdown 
                    paymentDeadline={transaction.payment_deadline} 
                    className="justify-center"
                  />
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Vendeur</label>
                <p className="font-medium">{transaction.seller_display_name}</p>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Total</span>
                  <span className="text-2xl font-bold">
                    {transaction.price.toFixed(2)} {transaction.currency}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  * Frais de plateforme RivvLock (5%) inclus
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                onClick={handleAuthRedirect}
                className="w-full"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Se connecter pour payer
              </Button>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Connectez-vous pour effectuer le paiement sécurisé via Stripe
          </p>
        </div>
      </div>
    );
  }

  // Show transaction details and processing state for authenticated users
  if (user && transaction) {
    // Show bank transfer instructions if selected
    if (showBankInstructions) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center">
              <img 
                src="/assets/rivvlock-logo.jpeg" 
                alt="RIVVLOCK Logo" 
                className="mx-auto h-16 w-auto object-contain mb-6"
                loading="lazy"
              />
            </div>
            <BankTransferInstructions transaction={transaction} />
            <Button 
              variant="outline"
              onClick={() => setShowBankInstructions(false)}
              className="w-full"
            >
              Retour
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {debugMode && (
          <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
            DEBUG: token={token} | txId={new URLSearchParams(window.location.search).get('txId')} | authenticated=true
          </div>
        )}
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <img 
              src="/assets/rivvlock-logo.jpeg" 
              alt="RIVVLOCK Logo" 
              className="mx-auto h-16 w-auto object-contain mb-6"
              loading="lazy"
            />
          </div>

          <div className="bg-card border rounded-lg p-6 space-y-4">
            <h1 className="text-2xl font-bold text-center">Paiement sécurisé</h1>
            
            {/* Payment Method Selector - Moved to top for visibility */}
            <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-4">
              <PaymentMethodSelector
                transaction={transaction}
                selectedMethod={selectedPaymentMethod}
                onMethodSelect={setSelectedPaymentMethod}
              />
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Service</label>
                <p className="font-semibold">{transaction.title}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{transaction.description}</p>
              </div>
              
              {transaction.service_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Date du service</label>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(transaction.service_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Vendeur</label>
                <p className="font-medium">{transaction.seller_display_name}</p>
              </div>
            </div>

            {processingPayment ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Préparation de votre paiement sécurisé...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vous allez être redirigé vers Stripe
                </p>
              </div>
            ) : (
              <Button 
                onClick={handlePayNow}
                className="w-full"
                size="lg"
                disabled={
                  !selectedPaymentMethod ||
                  processingPayment || 
                  (transaction.payment_deadline ? new Date(transaction.payment_deadline) < new Date() : false)
                }
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {!selectedPaymentMethod
                  ? 'Choisissez un mode de paiement'
                  : transaction.payment_deadline && new Date(transaction.payment_deadline) < new Date()
                    ? 'Délai expiré'
                    : processingPayment 
                      ? 'Préparation...'
                      : selectedPaymentMethod === 'bank_transfer' 
                        ? 'Voir les instructions de virement'
                        : 'Payer par carte'
                }
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