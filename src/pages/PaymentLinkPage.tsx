import { useEffect, useState } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CreditCard, Users } from 'lucide-react';
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
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [debugMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get('debug') === '1');

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
      
      const functionUrl = `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-transaction-by-token?token=${encodeURIComponent(finalToken)}`;
      
      // Check if user is authenticated and prepare headers
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0'
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        cache: 'no-store',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.success) {
        setError(data?.error || 'Erreur lors de la récupération de la transaction');
      } else if (data.transaction) {
        setTransaction(data.transaction);
      } else {
        setError('Données de transaction manquantes');
      }
    } catch (err: any) {
      setError(`Erreur lors de la récupération de la transaction: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTransaction = async () => {
    if (!user || !transaction || processingPayment) return;

    setProcessingPayment(true);
    try {
      // Join the transaction
      const { data: joinData, error: joinError } = await supabase.functions.invoke('join-transaction', {
        body: { 
          transaction_id: transaction.id,
          linkToken: token || new URLSearchParams(window.location.search).get('txId')
        }
      });

      if (joinError) throw joinError;
      if (joinData.error) throw new Error(joinData.error);

      // Wait a moment for database to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to transactions page with success indication
      window.location.href = '/dashboard/transactions?joined=success';
    } catch (err: any) {
      console.error('Error joining transaction:', err);
      setError(err.message || 'Erreur lors de l\'ajout de la transaction');
    } finally {
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
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Vendeur</label>
                <p className="font-medium">{transaction.seller_display_name}</p>
              </div>
              
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-medium">Montant</span>
                <span className="text-2xl font-bold">
                  {transaction.price} {transaction.currency}
                </span>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                onClick={handleAuthRedirect}
                className="w-full"
                size="lg"
              >
                <Users className="w-5 h-5 mr-2" />
                Joindre la transaction
              </Button>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Connectez-vous pour rejoindre cette transaction et effectuer le paiement sécurisé
          </p>
        </div>
      </div>
    );
  }

  // Show transaction details and processing state for authenticated users
  if (user && transaction) {
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
                onClick={handleJoinTransaction}
                className="w-full"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Rejoindre la transaction
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