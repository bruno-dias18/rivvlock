import { useTranslation } from 'react-i18next';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { useRealTimeStats } from '@/hooks/useRealTimeStats';
import { useRecentTransactions } from '@/hooks/useRecentTransactions';
import { CSVExporter } from '@/components/export/CSVExporter';
import { SecurityDashboard } from '@/components/security/SecurityDashboard';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  CreditCard,
  TrendingUp,
  AlertTriangle,
  Euro,
  RefreshCw
} from 'lucide-react';

export const Admin = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { stats, refreshStats } = useRealTimeStats();
  const { 
    transactions: recentTransactions,
    loading: transactionsLoading,
    getDisplayName,
    getStatusBadgeVariant,
    getActivityAction,
    formatTimeAgo
  } = useRecentTransactions(true);

  return (
    <AdminRoute>
      <Layout>
      <div className="space-y-6">
        {/* Admin Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('admin.dashboard')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de la plateforme RIVVLOCK
            </p>
          </div>
          <CSVExporter />
        </div>

        {/* Security Dashboard */}
        <SecurityDashboard />

        {/* Real-time stats header */}
        <motion.div 
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Statistiques en temps réel • Dernière MAJ: {new Date().toLocaleTimeString()}</span>
        </motion.div>

        {/* Alert Card for Disputes */}
        {stats.disputedTransactions > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="flex items-center p-6">
                <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
                <div>
                  <p className="font-medium text-yellow-800">
                    {stats.disputedTransactions} litiges en attente de résolution
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">
                    Action requise pour maintenir la qualité du service
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Admin Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Transactions
                </CardTitle>
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.monthlyTransactions} ce mois
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Volume Total
                </CardTitle>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(stats.totalVolume)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatAmount(stats.monthlyVolume)} ce mois
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Revenus Plateforme
                </CardTitle>
                <Euro className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatAmount(stats.totalFees)}
                </div>
                <p className="text-xs text-muted-foreground">
                  5% de frais sur {stats.completedTransactions} transactions
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Taux Conversion
                </CardTitle>
                <BarChart3 className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.conversionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.completedTransactions}/{stats.totalTransactions} complétées
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Transaction Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Répartition des Statuts
                </CardTitle>
                <CardDescription>
                  État actuel de toutes les transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm">En attente</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{stats.pendingTransactions}</div>
                      <div className="text-xs text-muted-foreground">
                        {((stats.pendingTransactions / Math.max(stats.totalTransactions, 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm">Payées</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{stats.paidTransactions}</div>
                      <div className="text-xs text-muted-foreground">
                        {((stats.paidTransactions / Math.max(stats.totalTransactions, 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm">Complétées</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{stats.completedTransactions}</div>
                      <div className="text-xs text-muted-foreground">
                        {((stats.completedTransactions / Math.max(stats.totalTransactions, 1)) * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {stats.disputedTransactions > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span className="text-sm">En litige</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{stats.disputedTransactions}</div>
                        <div className="text-xs text-muted-foreground">
                          {((stats.disputedTransactions / Math.max(stats.totalTransactions, 1)) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Performance Financière</CardTitle>
                <CardDescription>
                  Revenus et métriques de la plateforme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border">
                    <div className="text-2xl font-bold text-green-600">
                      {formatAmount(stats.totalFees)}
                    </div>
                    <p className="text-sm text-green-700">
                      Total revenus plateforme (5% sur {stats.completedTransactions} transactions)
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {formatAmount(stats.monthlyVolume)}
                      </div>
                      <p className="text-xs text-blue-700">Volume mensuel</p>
                    </div>
                    
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <div className="text-lg font-bold text-purple-600">
                        {formatAmount(stats.monthlyVolume * 0.05)}
                      </div>
                      <p className="text-xs text-purple-700">Revenus mensuels</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
            <CardDescription>
              Dernières transactions sur la plateforme • Mise à jour en temps réel
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Chargement...</span>
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucune transaction récente
              </div>
            ) : (
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadgeVariant(transaction.status)}>
                        {transaction.status.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="font-medium">
                          Tx #{transaction.id.slice(0, 8)} : {transaction.title}, {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}, status: {transaction.status}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getDisplayName(transaction)} • créé le {new Date(transaction.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Il y a {formatTimeAgo(transaction.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </Layout>
    </AdminRoute>
  );
};