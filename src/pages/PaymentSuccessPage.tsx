import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    // Auto-sync payments after successful payment
    const syncPayments = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
        if (error) {
          console.error('Sync error:', error);
        } else {
          console.log('Payment synced:', data);
        }
      } catch (error) {
        console.error('Failed to sync:', error);
      } finally {
        setSyncing(false);
      }
    };

    syncPayments();
  }, []);

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