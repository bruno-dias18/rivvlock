import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, User, BarChart3, Settings, Shield, Clock } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const quickStats = [
    {
      title: t('transactions.transactions'),
      value: '0',
      description: 'Transactions actives',
      icon: CreditCard,
    },
    {
      title: 'Volume',
      value: '€0',
      description: 'Volume total',
      icon: BarChart3,
    },
    {
      title: 'En attente',
      value: '0',
      description: 'Transactions en attente',
      icon: Clock,
    },
  ];

  const quickActions = [
    {
      title: t('transactions.transactions'),
      description: 'Gérer vos transactions d\'escrow',
      icon: CreditCard,
      href: '/dashboard/transactions',
    },
    {
      title: t('user.profile'),
      description: 'Mettre à jour vos informations',
      icon: User,
      href: '/dashboard/profile',
    },
    {
      title: 'Sécurité',
      description: 'Paramètres de sécurité du compte',
      icon: Shield,
      href: '/dashboard/profile',
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quickStats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <Card key={action.title} className="cursor-pointer hover:shadow-md transition-shadow">
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
      <Card>
        <CardHeader>
          <CardTitle>Activité récente</CardTitle>
          <CardDescription>
            Vos dernières actions sur la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune activité récente à afficher
          </p>
        </CardContent>
      </Card>
    </div>
  );
}