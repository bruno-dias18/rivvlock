import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TransactionsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('navigation.transactions')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.transactions')} - Gérez vos transactions d'escrow
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('transactions.new')}</CardTitle>
            <CardDescription>
              Créer une nouvelle transaction d'escrow
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
            <CardTitle>{t('transactions.pending')}</CardTitle>
            <CardDescription>
              Transactions en attente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aucune transaction en attente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.history')}</CardTitle>
            <CardDescription>
              Historique des transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aucun historique disponible
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}