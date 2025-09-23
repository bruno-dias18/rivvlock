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
      console.log('Fetching transaction with token:', token);
      const { data, error } = await supabase.functions.invoke('get-transaction-by-token', {
        body: { token }
      });

      if (error) throw error;

      console.log('Edge function response:', data);
      
      if (!data.success) {
        console.error('Transaction fetch failed:', data.error);
        setError(data.error || 'Erreur lors de la récupération de la transaction');
      } else {
        console.log('Transaction found:', data.transaction);
        setTransaction(data.transaction);
      }
    } catch (err: any) {
      console.error('Error fetching transaction:', err);
      setError('Erreur lors de la récupération de la transaction');
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

  // Show transaction details
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

  return null;
}