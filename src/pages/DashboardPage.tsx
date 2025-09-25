import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Clock, CheckCircle2, Lock, Settings } from 'lucide-react';
import { useTransactionCounts, useSyncStripePayments } from '@/hooks/useTransactions';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { BankAccountRequiredDialog } from '@/components/BankAccountRequiredDialog';
import { RecentActivityCard } from '@/components/RecentActivityCard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);

  const { data: counts, isLoading: countsLoading, error: countsError, refetch: refetchCounts } = useTransactionCounts();
  const { data: stripeAccount } = useStripeAccount();
  const { syncPayments } = useSyncStripePayments();

  // Force sync on dashboard load
  useEffect(() => {
    if (user) {
      console.log('🏠 Dashboard loaded for user:', user.email);
      // Trigger sync after a short delay to ensure everything is initialized
      const timer = setTimeout(async () => {
        try {
          console.log('🔄 Dashboard auto-sync triggered');
          await syncPayments();
          await refetchCounts();
        } catch (error) {
          console.error('Dashboard auto-sync failed:', error);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  const handleSyncPayments = async () => {
    toast.promise(
      (async () => {
        await syncPayments();
        await refetchCounts();
      })(),
      {
        loading: "Synchronisation en cours...",
        success: "Synchronisation terminée",
        error: "Erreur de synchronisation",
      }
    );
  };

  const transactionStatuses = [
    {
      title: 'En attente',
      description: 'Transactions en attente de paiement',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.pending || 0),
      icon: Clock,
      onClick: () => navigate('/dashboard/transactions?tab=pending'),
    },
    {
      title: 'Fonds bloqués',
      description: 'Transactions avec paiement effectué',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.paid || 0),
      icon: Lock,
      onClick: () => navigate('/dashboard/transactions?tab=blocked'),
    },
    {
      title: 'Complétées',
      description: 'Transactions terminées avec succès',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.validated || 0),
      icon: CheckCircle2,
      onClick: () => navigate('/dashboard/transactions?tab=completed'),
    },
  ];

  const quickActions = [
    {
      label: 'Nouvelle transaction',
      description: 'Créer une nouvelle transaction sécurisée',
      icon: Plus,
      onClick: () => {
        // Check if Stripe account is properly configured
        const isStripeReady = stripeAccount?.has_account && 
                             stripeAccount?.payouts_enabled && 
                             stripeAccount?.charges_enabled && 
                             stripeAccount?.details_submitted;
        
        if (!isStripeReady) {
          setIsBankAccountDialogOpen(true);
        } else {
          setIsNewTransactionOpen(true);
        }
      },
    },
    {
      label: 'Mon profil',
      description: 'Gérer mes informations personnelles',
      icon: Users,
      onClick: () => navigate('/dashboard/profile'),
    },
  ];

  return (
    <DashboardLayout onSyncPayments={handleSyncPayments}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">Tableau de bord</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {transactionStatuses.map((status, index) => (
            <Card 
              key={status.title} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={status.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {status.title}
                </CardTitle>
                <status.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{status.count}</div>
                <p className="text-xs text-muted-foreground">
                  {status.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Actions rapides</CardTitle>
              <CardDescription>
                Gérez vos transactions et votre profil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={action.onClick}
                >
                  <action.icon className="h-5 w-5 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">{action.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <RecentActivityCard />
        </div>
      </div>

      <BankAccountRequiredDialog
        open={isBankAccountDialogOpen}
        onOpenChange={setIsBankAccountDialogOpen}
        onSetupComplete={() => setIsNewTransactionOpen(true)}
      />

      <NewTransactionDialog
        open={isNewTransactionOpen}
        onOpenChange={setIsNewTransactionOpen}
      />
    </DashboardLayout>
  );
}