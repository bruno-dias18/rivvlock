import { useTranslation } from 'react-i18next';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { useTransactions } from '@/hooks/useTransactions';
import { motion } from 'framer-motion';
import { 
  Shield, 
  TrendingUp, 
  Users, 
  Clock,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Activity
} from 'lucide-react';

export const Admin = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { stats, transactions, loading } = useTransactions();

  if (loading) {
    return (
      <AdminRoute>
        <Layout>
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Chargement du panneau d'administration...</p>
            </div>
          </div>
        </Layout>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold gradient-text">Panneau d'Administration</h1>
              <p className="text-muted-foreground">Vue d'ensemble et gestion du système</p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                title: "Total Transactions",
                value: stats.totalTransactions,
                icon: Activity,
                color: "text-primary",
                bgColor: "bg-primary/10"
              },
              {
                title: "Volume Total",
                value: formatAmount(stats.totalVolume),
                icon: DollarSign,
                color: "text-green-600",
                bgColor: "bg-green-100"
              },
              {
                title: "En Attente",
                value: stats.pendingTransactions,
                icon: Clock,
                color: "text-yellow-600",
                bgColor: "bg-yellow-100"
              },
              {
                title: "Terminées",
                value: stats.completedTransactions,
                icon: CheckCircle,
                color: "text-green-600",
                bgColor: "bg-green-100"
              }
            ].map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                <Card>
                  <CardContent className="flex items-center p-6">
                    <div className={`p-2 rounded-lg ${stat.bgColor} mr-4`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold">
                        {stat.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions Récentes</CardTitle>
              <CardDescription>
                Aperçu des dernières transactions système
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <p className="text-muted-foreground">Aucune transaction pour le moment</p>
                  </div>
                ) : (
                  transactions.slice(0, 10).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{transaction.title}</h3>
                          <Badge variant={
                            transaction.status === 'validated' ? 'default' :
                            transaction.status === 'paid' ? 'secondary' :
                            transaction.status === 'pending' ? 'outline' : 'destructive'
                          }>
                            {transaction.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Créée le {new Date(transaction.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {formatAmount(transaction.price, transaction.currency)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </AdminRoute>
  );
};