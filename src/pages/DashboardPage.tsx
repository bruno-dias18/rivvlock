import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Clock, CheckCircle2, Lock, Settings, AlertTriangle, Bell, MessageSquare, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSyncStripePayments } from '@/hooks/useTransactions';
import { useNewItemsNotifications } from '@/hooks/useNewItemsNotifications';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
import { useUnreadQuotesGlobal } from '@/hooks/useUnreadQuotesGlobal';
import { useDashboardData } from '@/hooks/useDashboardData';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { BankAccountRequiredDialog } from '@/components/BankAccountRequiredDialog';
import { RecentActivityCard } from '@/components/RecentActivityCard';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { toast } from 'sonner';
import { useIsMobile } from '@/lib/mobileUtils';
import { useTranslation } from 'react-i18next';
import { logger } from '@/lib/logger';
import { useIsAdmin } from '@/hooks/useIsAdmin';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    if (isAdmin) {
      navigate('/dashboard/admin', { replace: true });
    }
  }, [isAdmin, navigate]);

  // Optimized: Single API call for all dashboard data
  const { data: dashboardData, isLoading: countsLoading, error: countsError, refetch: refetchCounts } = useDashboardData();
  const { syncPayments } = useSyncStripePayments();
  const { newCounts, markAsSeen, refetch: refetchNotifications } = useNewItemsNotifications();
  const { unreadCount: unreadAdminMessages } = useUnreadAdminMessages();
  const { unreadCount: unreadDisputeMessages } = useUnreadDisputesGlobal();
  const { unreadCount: unreadQuoteMessages } = useUnreadQuotesGlobal();

  // Extract data from optimized dashboard response
  const counts = dashboardData?.counts || { pending: 0, paid: 0, validated: 0 };
  const disputes = dashboardData?.disputes || [];
  const quotes = dashboardData?.quotes || [];
  const stripeAccount = dashboardData?.stripeAccount;
  const transactionIds = dashboardData?.transactionIds || [];

  // Message counts - now we only use transaction IDs (limited to 100)
  // This is for badge display, not critical for full accuracy
  const messageCounts = { pending: 0, blocked: 0, disputed: 0, completed: 0 };

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
      title: 'Devis',
      description: 'Devis en attente de réponse',
      count: String(quotes.length),
      isLoading: countsLoading,
      icon: FileText,
      category: 'quotes' as const,
      badgeColor: 'bg-purple-500 text-white hover:bg-purple-600',
      onClick: () => {
        navigate('/dashboard/quotes');
      },
    },
    {
      title: t('dashboard.pending'),
      description: t('dashboard.pendingDesc'),
      count: countsLoading ? null : countsError ? '!' : String(counts?.pending || 0),
      isLoading: countsLoading,
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
      count: countsLoading ? null : countsError ? '!' : String(counts?.paid || 0),
      isLoading: countsLoading,
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
      count: String(disputes.length),
      isLoading: countsLoading,
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
      count: countsLoading ? null : countsError ? '!' : String(counts?.validated || 0),
      isLoading: countsLoading,
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
                             stripeAccount.payouts_enabled && 
                             stripeAccount.charges_enabled && 
                             stripeAccount.details_submitted;
        
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
    <DashboardLayoutWithSidebar onSyncPayments={handleSyncPayments}>
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
                  <div className="flex items-center gap-1">
                    {newCounts[status.category] > 0 && (
                      <Badge variant="outline" className={`${status.badgeColor.replace('bg-', 'bg-').replace('-500', '-500/10').replace('text-white', `text-${status.badgeColor.split('-')[1]}-600`)} border-${status.badgeColor.split('-')[1]}-300`}>
                        <Bell className="h-3 w-3 mr-1" />
                        {newCounts[status.category]}
                      </Badge>
                    )}
                    {status.category === 'quotes' && unreadQuoteMessages > 0 && (
                      <Badge className={status.badgeColor}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {unreadQuoteMessages}
                      </Badge>
                    )}
                    {status.category !== 'quotes' && messageCounts[status.category] > 0 && (
                      <Badge className={status.badgeColor}>
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {messageCounts[status.category]}
                      </Badge>
                    )}
                    {status.category === 'disputed' && unreadDisputeMessages > 0 && (
                      <Badge className="bg-yellow-600 text-white hover:bg-yellow-700">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {unreadDisputeMessages}
                      </Badge>
                    )}
                    {status.category === 'disputed' && unreadAdminMessages > 0 && (
                      <Badge variant="destructive" className="bg-purple-600 text-white hover:bg-purple-700">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {unreadAdminMessages}
                      </Badge>
                    )}
                  </div>
                </CardTitle>
                <status.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className={isMobile ? "pt-1" : ""}>
                <div className={`font-bold ${isMobile ? "text-xl" : "text-2xl"}`}>
                  {status.isLoading ? (
                    <Skeleton className={`${isMobile ? "h-7 w-12" : "h-8 w-16"}`} />
                  ) : (
                    status.count
                  )}
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
                  <action.icon className={`mr-3 flex-shrink-0 ${isMobile ? "h-4 w-4" : "h-5 w-5"}`} />
                  <div className="text-left flex-1 min-w-0">
                    <div className={`font-medium ${isMobile ? "text-sm" : ""}`}>
                      {action.label}
                    </div>
                    <div className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"} truncate`}>
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
    </DashboardLayoutWithSidebar>
  );
}