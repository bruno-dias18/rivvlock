import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  Clock,
  Plus,
  ArrowUpRight
} from 'lucide-react';

// Mock data for demonstration
const mockTransactions = [
  {
    id: '1',
    title: 'Consultation IT',
    description: 'Services de consultation technique',
    amount: 2500,
    currency: 'EUR' as const,
    serviceDate: '2024-01-15',
    status: 'validated' as const,
  },
  {
    id: '2',
    title: 'Formation React',
    description: 'Formation développement web',
    amount: 1800,
    currency: 'CHF' as const,
    serviceDate: '2024-01-20',
    status: 'pending' as const,
  },
  {
    id: '3',
    title: 'Audit sécurité',
    description: 'Audit de sécurité informatique',
    amount: 3200,
    currency: 'EUR' as const,
    serviceDate: '2024-01-10',
    status: 'disputed' as const,
  },
];

const mockStats = {
  totalTransactions: 12,
  totalVolume: 28500,
  pendingTransactions: 3,
  completedTransactions: 8,
};

export const Dashboard = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'default',
      validated: 'default',
      paid: 'secondary',
      disputed: 'destructive',
    } as const;

    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      validated: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      disputed: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[status as keyof typeof colors]}>
        {t(`transactions.${status}`)}
      </Badge>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('dashboard.welcome')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos transactions escrow en toute sécurité
            </p>
          </div>
          <Button className="gradient-primary text-white">
            <Plus className="w-4 h-4 mr-2" />
            {t('transactions.new')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-between w-full">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold">{mockStats.totalTransactions}</p>
                </div>
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-between w-full">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Volume Total
                  </p>
                  <p className="text-2xl font-bold">{formatAmount(mockStats.totalVolume)}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-between w-full">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    En Attente
                  </p>
                  <p className="text-2xl font-bold">{mockStats.pendingTransactions}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center p-6">
              <div className="flex items-center justify-between w-full">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Terminées
                  </p>
                  <p className="text-2xl font-bold">{mockStats.completedTransactions}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('dashboard.transactions')}</CardTitle>
                <CardDescription>
                  Vos transactions récentes
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                Voir tout
                <ArrowUpRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">{transaction.title}</h3>
                      {getStatusBadge(transaction.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Service: {new Date(transaction.serviceDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatAmount(transaction.amount, transaction.currency)}
                    </p>
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