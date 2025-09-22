import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CreditCard, BarChart3, Download } from 'lucide-react';

export default function AdminPage() {
  const { t } = useTranslation();

  const stats = [
    {
      title: t('admin.users'),
      value: '0',
      description: 'Utilisateurs enregistrés',
      icon: Users,
      trend: '+0%',
    },
    {
      title: t('admin.transactions'),
      value: '0',
      description: 'Transactions totales',
      icon: CreditCard,
      trend: '+0%',
    },
    {
      title: t('admin.volume'),
      value: '€0',
      description: 'Volume des transactions',
      icon: BarChart3,
      trend: '+0%',
    },
    {
      title: t('admin.conversion'),
      value: '0%',
      description: 'Taux de conversion',
      icon: Download,
      trend: '+0%',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.admin')}</h1>
        <p className="text-muted-foreground">
          {t('admin.dashboard')} - Interface d'administration
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
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
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  {stat.trend}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Management Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestion des utilisateurs</CardTitle>
            <CardDescription>
              Administrer les comptes utilisateurs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fonctionnalité à implémenter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suivi des transactions</CardTitle>
            <CardDescription>
              Monitorer toutes les transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aucune transaction à afficher
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rapports et Analytics</CardTitle>
            <CardDescription>
              Générer des rapports détaillés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Système de rapports à implémenter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres système</CardTitle>
            <CardDescription>
              Configuration globale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Paramètres à configurer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs et monitoring</CardTitle>
            <CardDescription>
              Surveillance du système
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Interface de monitoring à développer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.export')}</CardTitle>
            <CardDescription>
              Exporter les données
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fonctionnalité d'export à implémenter
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}