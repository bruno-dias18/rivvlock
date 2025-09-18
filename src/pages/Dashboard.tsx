import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { useTransactions } from '@/hooks/useTransactions';
import { RivvlockLogo } from '@/components/ui/lock-animation';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  Clock,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

export const Dashboard = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const { transactions, stats, loading: transactionsLoading, getPaymentCountdown } = useTransactions();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Show loading state while checking auth
  if (authLoading || transactionsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      disputed: 'bg-red-100 text-red-800',
    };

    const labels = {
      pending: 'En attente',
      paid: 'Payé',
      completed: 'Terminé',
      disputed: 'Litigieux',
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <motion.div 
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4">
            <RivvlockLogo />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t('dashboard.welcome')}
              </h1>
              <p className="text-muted-foreground mt-1">
                Gérez vos transactions escrow en toute sécurité
              </p>
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              className="gradient-primary text-white"
              onClick={() => navigate('/create-transaction')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle transaction
            </Button>
          </motion.div>
        </motion.div>

        {/* Real-time indicator */}
        <motion.div 
          className="flex items-center gap-2 text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Données synchronisées en temps réel</span>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total Transactions",
              value: stats.totalTransactions,
              icon: CreditCard,
              color: "text-primary",
              delay: 0.1
            },
            {
              title: "Volume Total",
              value: formatAmount(stats.totalVolume),
              icon: TrendingUp,
              color: "text-success",
              delay: 0.2
            },
            {
              title: "En Attente",
              value: stats.pendingTransactions,
              icon: Clock,
              color: "text-yellow-500",
              delay: 0.3
            },
            {
              title: "Payées",
              value: stats.paidTransactions,
              icon: Users,
              color: "text-blue-500",
              delay: 0.4
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stat.delay, duration: 0.5 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="flex items-center p-6">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <motion.p 
                        className="text-2xl font-bold"
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: stat.delay }}
                      >
                        {stat.value}
                      </motion.p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('dashboard.transactions')}</CardTitle>
                <CardDescription>
                  {transactions.length === 0 ? 'Aucune transaction pour le moment' : 'Vos transactions récentes'}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/transactions')}
              >
                Voir tout
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune transaction créée</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => navigate('/create-transaction')}
                    >
                      Créer votre première transaction
                    </Button>
                  </div>
                </div>
              ) : (
                transactions.slice(0, 5).map((transaction) => {
                  const countdown = getPaymentCountdown(transaction);
                  return (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{transaction.title}</h3>
                          {getStatusBadge(transaction.status)}
                          {countdown && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {countdown}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Service: {new Date(transaction.service_date).toLocaleDateString()}
                        </p>
                        {countdown && countdown.includes('Expiré') && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Délai de paiement expiré</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatAmount(transaction.price, transaction.currency)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};