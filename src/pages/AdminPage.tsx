import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, CreditCard, BarChart3, Download, TrendingUp, TrendingDown, Activity, Clock, AlertTriangle, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAdminTransactions } from '@/hooks/useAdminTransactions';
import { useAdminActivityLogs } from '@/hooks/useAdminActivityLogs';
import { useAdminDisputeStats } from '@/hooks/useAdminDisputes';
import { useAdminDisputeNotifications } from '@/hooks/useAdminDisputeNotifications';
import { useAdminAnalytics, type AnalyticsPeriod } from '@/hooks/useAdminAnalytics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ValidateStripeAccountsButton } from '@/components/ValidateStripeAccountsButton';
import { AdminAnalyticsKPIs } from '@/components/AdminAnalyticsKPIs';
import { AdminAnalyticsCharts } from '@/components/AdminAnalyticsCharts';

export default function AdminPage() {
  const { t } = useTranslation();
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('30d');
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers(5);
  const { data: transactions, isLoading: transactionsLoading } = useAdminTransactions(5);
  const { data: activityLogs, isLoading: logsLoading } = useAdminActivityLogs(10);
  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics(analyticsPeriod);
  const { data: disputeStats, isLoading: disputeStatsLoading } = useAdminDisputeStats();
  
  // Hook pour les notifications de litiges escaladés
  useAdminDisputeNotifications();

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      EUR: '€',
      USD: '$',
      CHF: 'CHF',
      GBP: '£'
    };
    return symbols[currency] || currency;
  };

  const formatVolumesByCurrency = (volumesByCurrency: Record<string, number> = {}, trendsByCurrency: Record<string, number> = {}) => {
    const currencies = Object.keys(volumesByCurrency).sort((a, b) => volumesByCurrency[b] - volumesByCurrency[a]);
    
    if (currencies.length === 0) return { display: 'Aucun volume', trend: 0 };

    const mainCurrencies = currencies.slice(0, 3);
    const display = mainCurrencies
      .map(currency => {
        const symbol = getCurrencySymbol(currency);
        const amount = (volumesByCurrency[currency]?.toFixed(2) || '0');
        // Pour les devises avec symbole spécial, ne pas répéter le code
        if (symbol !== currency) {
          return `${symbol} ${amount}`;
        }
        // Pour les devises sans symbole spécial (comme CHF), afficher le code avec espace
        return `${currency} ${amount}`;
      })
      .join(' • ');
    
    // Calculer la tendance moyenne pondérée par le volume
    const totalVolume = currencies.reduce((sum, currency) => sum + (volumesByCurrency[currency] || 0), 0);
    const weightedTrend = totalVolume > 0 ? currencies.reduce((trend, currency) => {
      const volume = volumesByCurrency[currency] || 0;
      const currencyTrend = trendsByCurrency[currency] || 0;
      return trend + (currencyTrend * volume / totalVolume);
    }, 0) : 0;

    return { display, trend: weightedTrend };
  };

  const formatTrend = (trend: number) => {
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: number) => {
    return trend >= 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (trend: number) => {
    return trend >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const statsCards = [
    {
      title: t('admin.users'),
      value: stats?.usersCount?.toString() || '0',
      description: 'Utilisateurs enregistrés',
      icon: Users,
      trend: stats?.usersTrend || 0,
    },
    {
      title: t('admin.transactions'),
      value: stats?.transactionsCount?.toString() || '0',
      description: 'Transactions totales',
      icon: CreditCard,
      trend: stats?.transactionsTrend || 0,
    },
    {
      title: t('admin.volume'),
      value: formatVolumesByCurrency(stats?.volumesByCurrency, stats?.volumeTrendsByCurrency).display,
      description: 'Volume des transactions (30j)',
      icon: BarChart3,
      trend: formatVolumesByCurrency(stats?.volumesByCurrency, stats?.volumeTrendsByCurrency).trend,
    },
    {
      title: t('admin.conversion'),
      value: `${stats?.conversionRate?.toFixed(1) || '0'}%`,
      description: 'Taux de conversion (30j)',
      icon: Download,
      trend: stats?.conversionTrend || 0,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.admin')}</h1>
        <p className="text-muted-foreground">
          {t('admin.dashboard')} - Interface d'administration
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                  <div className="mt-2 flex items-center space-x-1">
                    {(() => {
                      const TrendIcon = getTrendIcon(stat.trend);
                      return (
                        <TrendIcon className={`h-3 w-3 ${getTrendColor(stat.trend)}`} />
                      );
                    })()}
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getTrendColor(stat.trend)}`}
                    >
                      {formatTrend(stat.trend)}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Disputes Management - PRIORITAIRE */}
        <Card className="relative">
          {/* Badge de notification pour les escalades */}
          {disputeStats && disputeStats.escalated > 0 && (
            <div className="absolute -top-2 -right-2 z-10">
              <Badge className="bg-red-600 text-white px-2 py-1 text-xs font-bold shadow-lg animate-pulse">
                {disputeStats.escalated} escaladé{disputeStats.escalated > 1 ? 's' : ''}
              </Badge>
            </div>
          )}
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Gestion des Litiges</span>
            </CardTitle>
            <CardDescription>
              Suivi et résolution des litiges clients
            </CardDescription>
          </CardHeader>
          <CardContent>
            {disputeStatsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : disputeStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-red-600">{disputeStats.open}</div>
                    <div className="text-xs text-muted-foreground">Ouverts</div>
                  </div>
                  <div className="relative">
                    <div className="text-2xl font-bold text-purple-600">{disputeStats.escalated}</div>
                    <div className="text-xs text-muted-foreground">Escaladés</div>
                    {disputeStats.escalated > 0 && (
                      <div className="absolute -top-1 -right-1">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{disputeStats.resolved}</div>
                    <div className="text-xs text-muted-foreground">Résolus</div>
                  </div>
                </div>
                {disputeStats.escalated > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {disputeStats.escalated} litige{disputeStats.escalated > 1 ? 's nécessitent' : ' nécessite'} votre attention
                    </p>
                  </div>
                )}
                <Link to="/dashboard/admin/disputes">
                  <Button className="w-full">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Gérer les Litiges
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Aucune donnée de litige disponible
                </p>
                <Link to="/dashboard/admin/disputes">
                  <Button variant="outline" className="w-full">
                    Voir les Litiges
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Utilisateurs récents</span>
            </CardTitle>
            <CardDescription>
              Les derniers utilisateurs inscrits
            </CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users && users.length > 0 ? (
              <div className="space-y-3">
                {users.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {(user.first_name?.[0] || user.last_name?.[0] || 'U').toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : 'Utilisateur'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={user.verified ? "default" : "secondary"} className="text-xs">
                      {user.user_type}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun utilisateur trouvé
              </p>
            )}
          </CardContent>
        </Card>

        {/* Transactions Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Transactions récentes</span>
            </CardTitle>
            <CardDescription>
              Les dernières transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-16" />
                  </div>
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">
                        {transaction.title}
                      </p>
                      <Badge 
                        variant={
                          transaction.status === 'validated' ? 'default' :
                          transaction.status === 'paid' ? 'secondary' : 'outline'
                        }
                        className="text-xs"
                      >
                        {transaction.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {(() => {
                          const symbol = getCurrencySymbol(transaction.currency);
                          const amount = Number(transaction.price).toFixed(2);
                          // Pour les devises avec symbole spécial, ne pas répéter le code
                          if (symbol !== transaction.currency) {
                            return `${symbol} ${amount}`;
                          }
                          // Pour les devises sans symbole spécial (comme CHF), afficher le code avec espace
                          return `${transaction.currency} ${amount}`;
                        })()}
                      </span>
                      <span>{format(new Date(transaction.created_at), 'dd/MM', { locale: fr })}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune transaction trouvée
              </p>
            )}
          </CardContent>
        </Card>

        {/* Activity Logs */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Activité récente</span>
            </CardTitle>
            <CardDescription>
              Les dernières actions système
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-20" />
                  </div>
                ))}
              </div>
            ) : activityLogs && activityLogs.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {activityLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="space-y-1">
                    <p className="text-sm font-medium truncate">
                      {log.title}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(log.created_at), 'dd/MM HH:mm', { locale: fr })}</span>
                      <Badge variant="outline" className="text-xs">
                        {log.activity_type}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune activité récente
              </p>
            )}
          </CardContent>
        </Card>

        {/* Analytics Section - Two columns on desktop */}
        <div className="grid gap-6 md:grid-cols-2 md:col-span-2 lg:grid-cols-2 lg:col-span-3">
          {/* Analytics KPIs */}
          <Card>
            <CardHeader>
              <CardTitle>Métriques clés</CardTitle>
              <CardDescription>
                Indicateurs de performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminAnalyticsKPIs 
                period={analyticsPeriod}
                onPeriodChange={setAnalyticsPeriod}
                analytics={analytics ? {
                  totalTransactions: analytics.totalTransactions,
                  totalVolume: analytics.totalVolume,
                  totalUsers: analytics.totalUsers,
                  currencyVolumes: analytics.currencyVolumes,
                  timeSeries: analytics.timeSeries
                } : undefined}
                isLoading={analyticsLoading}
              />
            </CardContent>
          </Card>

          {/* Analytics Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Graphiques</CardTitle>
              <CardDescription>
                Visualisation des données
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminAnalyticsCharts 
                analytics={analytics}
                isLoading={analyticsLoading}
              />
            </CardContent>
          </Card>
        </div>

        {/* Admin Tools Section - Two columns on desktop */}
        <div className="grid gap-6 md:grid-cols-2 md:col-span-2 lg:grid-cols-2 lg:col-span-3">
          {/* System Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Paramètres système</CardTitle>
              <CardDescription>
                Configuration et maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Validation des comptes Stripe Connect
                </p>
                <ValidateStripeAccountsButton />
              </div>
            </CardContent>
          </Card>

          {/* Export and Reports */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Export et rapports</span>
              </CardTitle>
              <CardDescription>
                Génération de rapports et exports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  Exporter les données analytics au format CSV
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Utilisez le bouton d'export dans la section "Métriques clés"
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}