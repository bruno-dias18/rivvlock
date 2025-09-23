import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
export default function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  interface PendingTransaction {
    id: string;
    title: string;
    price: number;
    currency: string;
    shared_link_token: string | null;
    created_at: string;
    status: string;
    buyer_id: string | null;
  }

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTransaction[]>([]);

  const baseUrl = useMemo(() => {
    if (typeof window === 'undefined') return 'https://rivvlock.com';
    const origin = window.location.origin;
    // Ensure public domain is used when copying links
    return origin.includes('lovableproject.com') ? origin.replace('lovableproject.com', 'lovable.app') : origin;
  }, []);

  useEffect(() => {
    const fetchPending = async () => {
      if (!user?.id) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('id,title,price,currency,shared_link_token,created_at,status,buyer_id')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setPending(data || []);
      } catch (e: any) {
        console.error('Error loading pending transactions', e);
        setError(e.message || 'Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, [user?.id]);
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
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune transaction en attente</p>
            ) : (
              <ul className="space-y-4">
                {pending.map((tx) => {
                  const joinLink = tx.shared_link_token ? `${baseUrl}/join-transaction/${tx.shared_link_token}` : null;
                  const handleCopy = async () => {
                    if (!joinLink) return;
                    try {
                      await navigator.clipboard.writeText(joinLink);
                      toast.success('Lien copié');
                    } catch (e) {
                      toast.error('Impossible de copier le lien');
                    }
                  };
                  return (
                    <li key={tx.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{tx.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {tx.price} {tx.currency}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {joinLink ? (
                            <>
                              <Button variant="outline" size="sm" onClick={handleCopy}>Copier le lien</Button>
                              <a href={joinLink} target="_blank" rel="noreferrer">
                                <Button size="sm">Ouvrir</Button>
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Lien indisponible</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
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