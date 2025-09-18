import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  BarChart3, 
  Download, 
  Users, 
  CreditCard,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

// Mock admin data
const mockAdminStats = {
  totalUsers: 1247,
  totalTransactions: 3456,
  monthlyVolume: 125000,
  conversionRate: 94.2,
  pendingDisputes: 12,
  activeUsers: 892,
};

const mockTransactionData = [
  { month: 'Jan', volume: 25000, count: 145 },
  { month: 'Fév', volume: 32000, count: 187 },
  { month: 'Mar', volume: 28000, count: 163 },
  { month: 'Avr', volume: 35000, count: 201 },
  { month: 'Mai', volume: 42000, count: 234 },
  { month: 'Jun', volume: 38000, count: 218 },
];

export const Admin = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  const handleExportCSV = () => {
    console.log('Exporting CSV...');
    // TODO: Implement CSV export
  };

  return (
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
          <Button onClick={handleExportCSV} className="gradient-success text-white">
            <Download className="w-4 h-4 mr-2" />
            {t('admin.export')}
          </Button>
        </div>

        {/* Alert Card for Disputes */}
        {mockAdminStats.pendingDisputes > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="flex items-center p-6">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
              <div>
                <p className="font-medium text-yellow-800">
                  {mockAdminStats.pendingDisputes} litiges en attente de résolution
                </p>
                <p className="text-sm text-yellow-600 mt-1">
                  Action requise pour maintenir la qualité du service
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('admin.users')}
              </CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAdminStats.totalUsers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {mockAdminStats.activeUsers} actifs ce mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('admin.transactions')}
              </CardTitle>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAdminStats.totalTransactions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +12% par rapport au mois dernier
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t('admin.volume')}
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatAmount(mockAdminStats.monthlyVolume)}
              </div>
              <p className="text-xs text-muted-foreground">
                Volume mensuel
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Conversion Rate & Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Taux de {t('admin.conversion')}
              </CardTitle>
              <CardDescription>
                Pourcentage de transactions réussies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4">
                <div className="text-4xl font-bold text-success">
                  {mockAdminStats.conversionRate}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-success h-3 rounded-full transition-all duration-500"
                    style={{ width: `${mockAdminStats.conversionRate}%` }}
                  ></div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Excellent taux de satisfaction client
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volume par Mois</CardTitle>
              <CardDescription>
                Évolution du volume de transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTransactionData.slice(-3).map((data, index) => (
                  <div key={data.month} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm font-medium">{data.month}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatAmount(data.volume)}</div>
                      <div className="text-xs text-muted-foreground">
                        {data.count} transactions
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Activité Récente</CardTitle>
            <CardDescription>
              Dernières actions sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: 'Nouvelle inscription', user: 'Marie Dubois', time: '5 min', type: 'user' },
                { action: 'Transaction validée', user: 'Tech Solutions SA', time: '12 min', type: 'success' },
                { action: 'Litige ouvert', user: 'Jean Martin', time: '25 min', type: 'warning' },
                { action: 'Paiement effectué', user: 'Innovation Lab', time: '1h', type: 'success' },
              ].map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge variant={activity.type === 'success' ? 'default' : activity.type === 'warning' ? 'destructive' : 'secondary'}>
                      {activity.type === 'user' ? 'User' : activity.type === 'success' ? 'Success' : 'Warning'}
                    </Badge>
                    <div>
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.user}</p>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Il y a {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};