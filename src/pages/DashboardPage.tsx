import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Settings, Clock, Lock, CheckCircle, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { RecentActivityCard } from '@/components/RecentActivityCard';
import { useTransactionCounts, useSyncStripePayments } from '@/hooks/useTransactions';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  
  const { data: counts, isLoading: countsLoading, error: countsError, refetch: refetchCounts } = useTransactionCounts();
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
    const loadingToastId = toast.loading("Synchronisation en cours...", {
      description: "Vérification des paiements Stripe",
    });
    
    try {
      await syncPayments();
      await refetchCounts();
      
      toast.dismiss(loadingToastId);
      toast.success("Synchronisation terminée", {
        description: "Les données ont été mises à jour",
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast.dismiss(loadingToastId);
      toast.error("Erreur de synchronisation", {
        description: "Impossible de synchroniser les paiements",
      });
    }
  };

  const transactionStatuses = [
    {
      title: 'En attente',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.pending || 0),
      icon: Clock,
      variant: 'outline' as const,
      onClick: () => navigate('/dashboard/transactions?tab=pending'),
      hasError: countsError,
    },
    {
      title: 'Fonds bloqués',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.paid || 0),
      icon: Lock,
      variant: 'outline' as const,
      onClick: () => navigate('/dashboard/transactions?tab=blocked'),
      hasError: countsError,
    },
    {
      title: 'Complétée',
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.validated || 0),
      icon: CheckCircle,
      variant: 'default' as const,
      onClick: () => navigate('/dashboard/transactions?tab=completed'),
      hasError: countsError,
    },
  ];

  const quickActions = [
    {
      title: 'Nouvelle transaction',
      description: 'Créer une nouvelle transaction d\'escrow',
      icon: Plus,
      onClick: () => setIsNewTransactionOpen(true),
    },
    {
      title: t('user.profile'),
      description: 'Mettre à jour vos informations',
      icon: User,
      onClick: () => navigate('/dashboard/profile'),
    },
    {
      title: 'Actualiser les paiements',
      description: '',
      icon: RefreshCw,
      onClick: handleSyncPayments,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {t('dashboard.welcome')}
        </h1>
        <p className="text-muted-foreground">
          Bienvenue, {user?.email}
        </p>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Transactions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {transactionStatuses.map((status) => (
            <Button
              key={status.title}
              variant={status.variant}
              className={`h-auto p-4 flex-col items-start gap-2 ${status.hasError ? 'border-destructive' : ''}`}
              onClick={status.onClick}
            >
              <div className="flex items-center gap-2">
                {status.hasError ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <status.icon className="h-4 w-4" />
                )}
                <span className="font-medium">{status.title}</span>
              </div>
              <div className={`text-2xl font-bold ${status.hasError ? 'text-destructive' : ''}`}>
                {status.count}
              </div>
              {status.hasError && (
                <div className="text-xs text-destructive">Erreur de chargement</div>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <Card 
              key={action.title} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={action.onClick}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <action.icon className="h-5 w-5" />
                  {action.title}
                </CardTitle>
                <CardDescription>
                  {action.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivityCard />

      <NewTransactionDialog 
        open={isNewTransactionOpen}
        onOpenChange={setIsNewTransactionOpen}
      />
    </div>
  );
}