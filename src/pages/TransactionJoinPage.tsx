import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, Users } from 'lucide-react';
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

export default function TransactionJoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [debugMode] = useState<boolean>(() => new URLSearchParams(window.location.search).get('debug') === '1');

  useEffect(() => {
    if (!token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }

    fetchTransaction();
  }, [token]);

  const fetchTransaction = async () => {
    try {
      console.log('🔍 [TransactionJoin] Fetching transaction with token:', token);
      
      // Support both URL token and query param txId for existing links
      const searchParams = new URLSearchParams(window.location.search);
      const txId = searchParams.get('txId');
      const finalToken = token || txId;
      
      if (!finalToken) {
        throw new Error('No transaction token found in URL or query params');
      }
      
      console.log('🔍 [TransactionJoin] Using token:', finalToken, '(source:', token ? 'URL' : 'txId query param', ')');
      
      const functionUrl = `https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-transaction-by-token?token=${encodeURIComponent(finalToken)}`;
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      const authed = !!session?.access_token;
      setIsAuthenticated(authed);
      console.log('🔍 [TransactionJoin] User authenticated:', authed);
      
      // Only include Authorization header if user is authenticated
      const headers: Record<string, string> = {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsdGh5eHFydWhmdXlmbWV4dHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxODIxMzcsImV4cCI6MjA3Mzc1ODEzN30.QFrsO1ThBjlQ_WRFGSHz-Pc3Giot1ijgUqSHVLykGW0'
      };
      
      if (authed) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(functionUrl, {
        method: 'GET',
        cache: 'no-store',
        headers
      });
      
      if (!response.ok) {
        console.error('🚨 [TransactionJoin] HTTP error:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 [TransactionJoin] Edge function response:', data);
      
      if (!data || !data.success) {
        console.error('🚨 [TransactionJoin] Transaction fetch failed:', data?.error || 'No data received');
        setError(data?.error || 'Erreur lors de la récupération de la transaction');
      } else if (data.transaction) {
        console.log('✅ [TransactionJoin] Transaction found:', data.transaction);
        setTransaction(data.transaction);
      } else {
        console.error('🚨 [TransactionJoin] Transaction data missing from response');
        setError('Données de transaction manquantes');
      }
    } catch (err: any) {
      console.error('🚨 [TransactionJoin] Error fetching transaction:', err);
      setError(`Erreur lors de la récupération de la transaction: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTransaction = () => {
    const redirectUrl = `/payment-link/${token}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
  };

// Show loading state
if (loading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {debugMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
          DEBUG: token={token} | authenticated={String(isAuthenticated)}
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
          DEBUG: token={token} | authenticated={String(isAuthenticated)} | error={error}
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

// Show transaction details
if (transaction) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {debugMode && (
        <div className="fixed top-0 left-0 right-0 bg-yellow-100 text-yellow-800 text-xs p-2 text-center">
          DEBUG: token={token} | authenticated={String(isAuthenticated)} | txId={new URLSearchParams(window.location.search).get('txId')}
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
              onClick={handleJoinTransaction}
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

  // Default fallback - should not reach here
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">État inattendu</h1>
        <p className="text-muted-foreground mb-6">
          Une erreur inattendue s'est produite lors du chargement de la transaction.
        </p>
        <Button onClick={() => window.location.href = '/'}>
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}