import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Wait for auth to be ready
    if (authLoading) return;
    
    // Check if user is authenticated
    if (!user) {
      logger.warn('User not authenticated on payment success page');
      toast.error('Session expirée, veuillez vous reconnecter');
      navigate('/auth');
      return;
    }
    // Auto-sync payments after successful payment with retries
    const syncPayments = async () => {
      let attempts = 0;
      const maxAttempts = 3;
      
      const attemptSync = async () => {
        try {
          attempts++;
          const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
          if (error) {
            throw error;
          }
          
          setSyncing(false);
          
          if (data?.transactions_updated > 0) {
            toast.success(`${data.transactions_updated} transaction(s) synchronisée(s)`);
          }
        } catch (error) {
          logger.error(`Sync attempt ${attempts} failed:`, error);
          
          if (attempts < maxAttempts) {
            // Retry after delay
            setTimeout(attemptSync, 2000 * attempts);
          } else {
            setSyncing(false);
            toast.error('Erreur lors de la synchronisation des paiements');
          }
        }
      };

      attemptSync();
    };

    syncPayments();
  }, [authLoading, user, navigate]);

  const handleViewTransactions = () => {
    navigate('/dashboard/transactions?tab=blocked');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Paiement réussi !</CardTitle>
          <CardDescription>
            Votre paiement a été effectué avec succès. Les fonds sont maintenant bloqués en sécurité.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {syncing && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
              <p className="text-sm text-muted-foreground">
                Synchronisation en cours...
              </p>
            </div>
          )}
          
          <Button 
            className="w-full" 
            onClick={handleViewTransactions}
          >
            Voir mes transactions
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => navigate('/dashboard')}
          >
            Retour au tableau de bord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}