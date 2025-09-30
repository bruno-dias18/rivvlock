import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Clock, CheckCircle2, Lock, Settings, AlertTriangle } from 'lucide-react';
import { useTransactionCounts, useSyncStripePayments } from '@/hooks/useTransactions';
import { useDisputes } from '@/hooks/useDisputes';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useNewItemsNotifications } from '@/hooks/useNewItemsNotifications';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { BankAccountRequiredDialog } from '@/components/BankAccountRequiredDialog';
import { RecentActivityCard } from '@/components/RecentActivityCard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { toast } from 'sonner';
import { useIsMobile } from '@/lib/mobileUtils';
import { useTranslation } from 'react-i18next';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);

  const { data: counts, isLoading: countsLoading, error: countsError, refetch: refetchCounts } = useTransactionCounts();
  const { data: stripeAccount } = useStripeAccount();
  const { syncPayments } = useSyncStripePayments();
  const { data: disputes } = useDisputes();
  const { newCounts, markAsSeen, refetch: refetchNotifications } = useNewItemsNotifications();

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
        loading: t('dashboard.syncInProgress'),
        success: t('dashboard.syncComplete'),
        error: t('dashboard.syncError'),
      }
    );
  };

  const transactionStatuses = [
    {
      title: t('dashboard.pending'),
      description: t('dashboard.pendingDesc'),
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.pending || 0),
      icon: Clock,
      category: 'pending' as const,
      badgeColor: 'bg-blue-500 text-white hover:bg-blue-600',
      onClick: () => {
        markAsSeen('pending');
        refetchNotifications();
        navigate('/dashboard/transactions?tab=pending');
      },
    },
    {
      title: t('dashboard.blocked'),
      description: t('dashboard.blockedDesc'),
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.paid || 0),
      icon: Lock,
      category: 'blocked' as const,
      badgeColor: 'bg-orange-500 text-white hover:bg-orange-600',
      onClick: () => {
        markAsSeen('blocked');
        refetchNotifications();
        navigate('/dashboard/transactions?tab=blocked');
      },
    },
    {
      title: t('transactions.disputed'),
      description: t('transactions.disputedDescription'),
      count: String(disputes?.length || 0),
      icon: AlertTriangle,
      category: 'disputed' as const,
      badgeColor: 'bg-red-500 text-white hover:bg-red-600',
      onClick: () => {
        markAsSeen('disputed');
        refetchNotifications();
        navigate('/dashboard/transactions?tab=disputed');
      },
    },
    {
      title: t('dashboard.completed'),
      description: t('dashboard.completedDesc'),
      count: countsLoading ? '...' : countsError ? '!' : String(counts?.validated || 0),
      icon: CheckCircle2,
      category: 'completed' as const,
      badgeColor: 'bg-green-500 text-white hover:bg-green-600',
      onClick: () => {
        markAsSeen('completed');
        refetchNotifications();
        navigate('/dashboard/transactions?tab=completed');
      },
    },
  ];

  const quickActions = [
    {
      label: t('dashboard.newTransaction'),
      description: t('dashboard.newTransactionDesc'),
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
      label: t('dashboard.myProfile'),
      description: t('dashboard.myProfileDesc'),
      icon: Users,
      onClick: () => navigate('/dashboard/profile'),
    },
  ];

  return (
    <DashboardLayout onSyncPayments={handleSyncPayments}>
      <div className={isMobile ? "space-y-4" : "space-y-6"}>
        <div className="flex justify-between items-center">
          <h1 className={`font-bold text-foreground ${isMobile ? "text-2xl" : "text-3xl"}`}>
            {t('dashboard.title')}
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
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span>{status.title}</span>
                  {newCounts[status.category] > 0 && (
                    <Badge className={status.badgeColor}>
                      {newCounts[status.category]}
                    </Badge>
                  )}
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
              <CardTitle className={isMobile ? "text-lg" : ""}>{t('common.quickActions')}</CardTitle>
              <CardDescription>
                {t('dashboard.manageTransactions')}
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