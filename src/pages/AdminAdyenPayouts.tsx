import { useState } from 'react';
import { useAdyenPayouts } from '@/hooks/useAdyenPayouts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Clock, Download, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
// Format currency helper
const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: currency || 'CHF',
  }).format(amount);
};

export default function AdminAdyenPayouts() {
  const { payouts, summary, updatePayoutStatus } = useAdyenPayouts();
  const [selectedPayout, setSelectedPayout] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const pendingPayouts = payouts?.filter(p => p.status === 'pending') || [];
  const sentPayouts = payouts?.filter(p => p.status === 'sent') || [];
  const completedPayouts = payouts?.filter(p => p.status === 'completed') || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success">Payé</Badge>;
      case 'sent':
        return <Badge className="bg-warning">Envoyé</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  };

  const handleExportSEPA = () => {
    // TODO: Generate SEPA XML file
    toast.info('Fonctionnalité SEPA en développement');
  };

  const handleMarkAsSent = (payoutId: string) => {
    updatePayoutStatus.mutate({
      id: payoutId,
      status: 'sent',
      notes: adminNotes,
    });
    setAdminNotes('');
  };

  const handleMarkAsCompleted = (payoutId: string) => {
    updatePayoutStatus.mutate({
      id: payoutId,
      status: 'completed',
      notes: adminNotes,
    });
    setAdminNotes('');
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Comptabilité Adyen</h1>
        <p className="text-muted-foreground">
          Gestion des paiements vendeurs et suivi comptable
        </p>
      </div>

      {/* Accounting Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capturé</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_captured || 0, 'CHF')}
            </div>
            <p className="text-xs text-muted-foreground">
              Montants capturés via Adyen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dû aux Vendeurs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {formatCurrency(summary?.total_owed_to_sellers || 0, 'CHF')}
            </div>
            <p className="text-xs text-muted-foreground">
              95% des montants capturés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Brute</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.total_platform_commission || 0, 'CHF')}
            </div>
            <p className="text-xs text-muted-foreground">
              5% des montants capturés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenu Net</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {formatCurrency(summary?.total_net_revenue || 0, 'CHF')}
            </div>
            <p className="text-xs text-muted-foreground">
              Commission - frais Adyen (~{summary?.total_estimated_fees ? formatCurrency(summary.total_estimated_fees, 'CHF') : '0 CHF'})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts Alert */}
      {pendingPayouts.length > 0 && (
        <Card className="mb-6 border-warning">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warning" />
                <CardTitle>Paiements en attente</CardTitle>
              </div>
              <Badge variant="outline" className="text-lg">
                {pendingPayouts.length} paiement(s)
              </Badge>
            </div>
            <CardDescription>
              Total à virer : <strong>{formatCurrency(summary?.pending_payouts_amount || 0, 'CHF')}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={handleExportSEPA} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exporter SEPA
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payouts List */}
      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">
            En attente ({pendingPayouts.length})
          </TabsTrigger>
          <TabsTrigger value="sent">
            Envoyés ({sentPayouts.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Payés ({completedPayouts.length})
          </TabsTrigger>
        </TabsList>

        {['pending', 'sent', 'completed'].map((tab) => {
          const tabPayouts = tab === 'pending' ? pendingPayouts : 
                            tab === 'sent' ? sentPayouts : 
                            completedPayouts;

          return (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {tabPayouts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Aucun paiement dans cette catégorie
                  </CardContent>
                </Card>
              ) : (
                tabPayouts.map((payout) => (
                  <Card key={payout.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            Transaction {payout.transaction_id.substring(0, 8)}...
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {payout.account_holder_name} • {payout.iban_destination.substring(0, 8)}****
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {formatCurrency(payout.seller_amount / 100, payout.currency)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Montant vendeur
                            </div>
                          </div>
                          {getStatusBadge(payout.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">Montant brut:</span>
                          <p className="font-medium">{formatCurrency(payout.gross_amount / 100, payout.currency)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Commission (5%):</span>
                          <p className="font-medium">{formatCurrency(payout.platform_commission / 100, payout.currency)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Frais Adyen:</span>
                          <p className="font-medium text-destructive">-{formatCurrency(payout.estimated_processor_fees / 100, payout.currency)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Revenu net:</span>
                          <p className="font-medium text-success">{formatCurrency(payout.net_platform_revenue / 100, payout.currency)}</p>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground mb-4">
                        Créé le {new Date(payout.created_at).toLocaleString()}
                        {payout.sent_at && <> • Envoyé le {new Date(payout.sent_at).toLocaleString()}</>}
                        {payout.completed_at && <> • Payé le {new Date(payout.completed_at).toLocaleString()}</>}
                      </div>

                      {payout.admin_notes && (
                        <div className="p-3 bg-muted rounded-lg mb-4 text-sm">
                          <strong>Notes:</strong> {payout.admin_notes}
                        </div>
                      )}

                      {payout.status === 'pending' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" onClick={() => setSelectedPayout(payout.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marquer comme envoyé
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirmer l'envoi du paiement</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="p-4 border rounded-lg bg-muted/50">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <span className="text-muted-foreground">Bénéficiaire:</span>
                                  <span className="font-medium">{payout.account_holder_name}</span>
                                  
                                  <span className="text-muted-foreground">IBAN:</span>
                                  <span className="font-mono text-xs">{payout.iban_destination}</span>
                                  
                                  <span className="text-muted-foreground">Montant:</span>
                                  <span className="font-bold">{formatCurrency(payout.seller_amount / 100, payout.currency)}</span>
                                </div>
                              </div>

                              <div>
                                <label className="text-sm font-medium block mb-2">
                                  Notes (optionnel)
                                </label>
                                <Textarea
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="Référence bancaire, notes internes..."
                                  rows={3}
                                />
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleMarkAsSent(payout.id)}
                                  disabled={updatePayoutStatus.isPending}
                                >
                                  Confirmer l'envoi
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {payout.status === 'sent' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marquer comme payé
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirmer la réception du paiement</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground">
                                Confirmez que le vendeur a bien reçu le paiement de <strong>{formatCurrency(payout.seller_amount / 100, payout.currency)}</strong>.
                              </p>

                              <div>
                                <label className="text-sm font-medium block mb-2">
                                  Notes (optionnel)
                                </label>
                                <Textarea
                                  value={adminNotes}
                                  onChange={(e) => setAdminNotes(e.target.value)}
                                  placeholder="Confirmation vendeur, date de réception..."
                                  rows={3}
                                />
                              </div>

                              <Button
                                onClick={() => handleMarkAsCompleted(payout.id)}
                                disabled={updatePayoutStatus.isPending}
                              >
                                Confirmer réception
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
