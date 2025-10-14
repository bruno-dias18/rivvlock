import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useProblematicTransactions } from '@/hooks/useProblematicTransactions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger';

export function AdminProblematicTransactions() {
  const { data: problematicTransactions, isLoading, refetch } = useProblematicTransactions();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deletingAll, setDeletingAll] = useState(false);
  const { toast } = useToast();

  const formatCurrency = (amount: number, currency: string) => {
    const symbols: Record<string, string> = {
      EUR: '€',
      USD: '$',
      CHF: 'CHF',
      GBP: '£'
    };
    const symbol = symbols[currency] || currency;
    return `${amount.toFixed(2)} ${symbol}`;
  };

  const handleDelete = async (transactionId: string, title: string) => {
    try {
      setDeletingIds(prev => new Set(prev).add(transactionId));
      
      logger.log('Deleting problematic transaction:', transactionId);
      
      const { data, error } = await supabase.functions.invoke('admin-delete-transaction', {
        body: { transactionId }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success(`Transaction "${title}" supprimée avec succès`);

      // Refresh the list
      refetch();
    } catch (error: any) {
      logger.error('Error deleting transaction:', error);
      toast.error(error);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(transactionId);
        return next;
      });
    }
  };

  const handleDeleteAll = async () => {
    if (!problematicTransactions || problematicTransactions.length === 0) return;

    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer ${problematicTransactions.length} transaction(s) bugguée(s) ?`
    );

    if (!confirmed) return;

    try {
      setDeletingAll(true);

      for (const transaction of problematicTransactions) {
        await supabase.functions.invoke('admin-delete-transaction', {
          body: { transactionId: transaction.id }
        });
      }

      toast.success(`${problematicTransactions.length} transaction(s) bugguée(s) supprimée(s)`);

      refetch();
    } catch (error: any) {
      logger.error('Error deleting all transactions:', error);
      toast.error(error);
    } finally {
      setDeletingAll(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Transactions problématiques
          </CardTitle>
          <CardDescription>Chargement...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!problematicTransactions || problematicTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Transactions problématiques
          </CardTitle>
          <CardDescription>Aucune transaction problématique détectée</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            ✅ Tout est en ordre !
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Transactions problématiques
            </CardTitle>
            <CardDescription>
              {problematicTransactions.length} transaction(s) payée(s) sans acheteur détectée(s)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteAll}
              disabled={deletingAll || problematicTransactions.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Tout supprimer ({problematicTransactions.length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {problematicTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <div className="font-medium">{transaction.title}</div>
                <div className="text-sm text-muted-foreground space-y-1 mt-1">
                  <div>💰 {formatCurrency(transaction.price, transaction.currency)}</div>
                  <div>🔑 ID: {transaction.id.substring(0, 8)}...</div>
                  <div>📅 Créée: {new Date(transaction.created_at).toLocaleString('fr-FR')}</div>
                  {transaction.stripe_payment_intent_id && (
                    <div className="text-xs">
                      💳 Stripe: {transaction.stripe_payment_intent_id.substring(0, 20)}...
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(transaction.id, transaction.title)}
                disabled={deletingIds.has(transaction.id) || deletingAll}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingIds.has(transaction.id) ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
