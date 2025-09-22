import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, User, Settings, Shield, Clock, Lock, CheckCircle, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const transactionStatuses = [
    {
      title: 'En attente',
      count: '0',
      icon: Clock,
      variant: 'outline' as const,
    },
    {
      title: 'Fonds bloqués',
      count: '0',
      icon: Lock,
      variant: 'outline' as const,
    },
    {
      title: 'Complétée',
      count: '0',
      icon: CheckCircle,
      variant: 'default' as const,
    },
  ];

  const quickActions = [
    {
      title: 'Nouvelle transaction',
      description: 'Créer une nouvelle transaction d\'escrow',
      icon: Plus,
      href: '/dashboard/transactions/new',
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
      href: '/dashboard/security',
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
              className="h-auto p-4 flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <status.icon className="h-4 w-4" />
                <span className="font-medium">{status.title}</span>
              </div>
              <div className="text-2xl font-bold">{status.count}</div>
            </Button>
          ))}
        </div>
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