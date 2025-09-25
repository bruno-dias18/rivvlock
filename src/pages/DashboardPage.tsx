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
import { useIsMobile } from '@/lib/mobileUtils';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
      <div className={isMobile ? "space-y-4" : "space-y-6"}>
        <div className="flex justify-between items-center">
          <h1 className={`font-bold text-foreground ${isMobile ? "text-2xl" : "text-3xl"}`}>
            Tableau de bord
          </h1>
        </div>

        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3"}`}>
          {transactionStatuses.map((status, index) => (
            <Card 
              key={status.title} 
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={status.onClick}
            >
              <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? "pb-1" : "pb-2"}`}>
                <CardTitle className="text-sm font-medium">
                  {status.title}
                </CardTitle>
                <status.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className={isMobile ? "pt-1" : ""}>
                <div className={`font-bold ${isMobile ? "text-xl" : "text-2xl"}`}>
                  {status.count}
                </div>
                <p className="text-xs text-muted-foreground">
                  {status.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className={`grid gap-4 ${isMobile ? "grid-cols-1" : "md:grid-cols-2"}`}>
          <Card>
            <CardHeader className={isMobile ? "pb-3" : ""}>
              <CardTitle className={isMobile ? "text-lg" : ""}>Actions rapides</CardTitle>
              <CardDescription>
                Gérez vos transactions et votre profil
              </CardDescription>
            </CardHeader>
            <CardContent className={isMobile ? "space-y-2" : "space-y-3"}>
              {quickActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className={`w-full justify-start h-auto ${isMobile ? "p-3" : "p-4"}`}
                  onClick={action.onClick}
                >
                  <action.icon className={`mr-3 ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                  <div className="text-left">
                    <div className={`font-medium ${isMobile ? "text-sm" : ""}`}>
                      {action.label}
                    </div>
                    <div className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}>
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