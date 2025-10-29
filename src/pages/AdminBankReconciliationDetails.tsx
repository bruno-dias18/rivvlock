import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ArrowLeft, CheckCircle2, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { useBankStatementDetails, useManualReconciliation } from '@/hooks/useBankStatements';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function AdminBankReconciliationDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useBankStatementDetails(id!);
  const manualReconciliation = useManualReconciliation();
  const [selectedReconciliation, setSelectedReconciliation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults } = useQuery({
    queryKey: ['search-transactions', searchQuery, selectedReconciliation?.bank_amount],
    queryFn: async () => {
      if (!searchQuery && !selectedReconciliation) return [];

      let query = supabase
        .from('transactions')
        .select('*')
        .eq('status', 'paid')
        .is('bank_reconciled', false)
        .limit(10);

      if (searchQuery) {
        query = query.or(
          `title.ilike.%${searchQuery}%,payment_reference.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by similar amount if available
      if (selectedReconciliation?.bank_amount) {
        const targetAmount = selectedReconciliation.bank_amount;
        return data?.filter((tx) => {
          const diff = Math.abs(tx.price - targetAmount);
          return diff / targetAmount <= 0.05; // ±5%
        });
      }

      return data;
    },
    enabled: !!selectedReconciliation,
  });

  const handleManualMatch = (transactionId: string) => {
    if (!selectedReconciliation) return;

    manualReconciliation.mutate(
      {
        reconciliationId: selectedReconciliation.id,
        transactionId,
      },
      {
        onSuccess: () => {
          setSelectedReconciliation(null);
          setSearchQuery('');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <p>Chargement...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <p>Relevé non trouvé</p>
      </div>
    );
  }

  const { statement, reconciliations } = data;
  const matched = reconciliations.filter((r) => r.reconciliation_status === 'matched');
  const pending = reconciliations.filter((r) => r.reconciliation_status === 'pending');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/admin/bank-reconciliation')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{statement.file_name}</h1>
          <p className="text-muted-foreground">
            Date: {format(new Date(statement.statement_date), 'dd/MM/yyyy')} • IBAN:{' '}
            {statement.account_iban}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Solde d'ouverture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statement.currency} {statement.opening_balance?.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Solde de clôture</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statement.currency} {statement.closing_balance?.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Réconciliées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{matched.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">En attente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pending.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matched">
        <TabsList>
          <TabsTrigger value="matched">
            Réconciliées ({matched.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            En attente ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            Toutes ({reconciliations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Référence QR</TableHead>
                  <TableHead>Débiteur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Transaction RivvLock</TableHead>
                  <TableHead>Confiance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((recon) => (
                  <TableRow key={recon.id}>
                    <TableCell>{format(new Date(recon.value_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono text-xs">{recon.bank_reference}</TableCell>
                    <TableCell>{recon.bank_debtor_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {recon.bank_currency} {recon.bank_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {recon.transaction ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigate(`/dashboard/transactions/${recon.transaction.id}`)}
                        >
                          <LinkIcon className="h-3 w-3 mr-1" />
                          {recon.transaction.title}
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {recon.match_confidence}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Référence QR</TableHead>
                  <TableHead>Débiteur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((recon) => (
                  <TableRow key={recon.id}>
                    <TableCell>{format(new Date(recon.value_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono text-xs">{recon.bank_reference}</TableCell>
                    <TableCell>{recon.bank_debtor_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {recon.bank_currency} {recon.bank_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReconciliation(recon)}
                      >
                        <LinkIcon className="h-3 w-3 mr-1" />
                        Rapprocher
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Référence QR</TableHead>
                  <TableHead>Débiteur</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((recon) => (
                  <TableRow key={recon.id}>
                    <TableCell>{format(new Date(recon.value_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono text-xs">{recon.bank_reference}</TableCell>
                    <TableCell>{recon.bank_debtor_name || '-'}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {recon.bank_currency} {recon.bank_amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {recon.reconciliation_status === 'matched' ? (
                        <Badge variant="default" className="bg-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Réconcilié
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          En attente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {recon.transaction ? (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => navigate(`/dashboard/transactions/${recon.transaction.id}`)}
                        >
                          {recon.transaction.title}
                        </Button>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedReconciliation} onOpenChange={() => setSelectedReconciliation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rapprochement manuel</DialogTitle>
            <DialogDescription>
              Recherchez et sélectionnez la transaction correspondante
            </DialogDescription>
          </DialogHeader>

          {selectedReconciliation && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Référence QR:</span>
                      <div className="font-mono">{selectedReconciliation.bank_reference}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Montant:</span>
                      <div className="font-semibold">
                        {selectedReconciliation.bank_currency}{' '}
                        {selectedReconciliation.bank_amount.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>
                      <div>{format(new Date(selectedReconciliation.value_date), 'dd/MM/yyyy')}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Débiteur:</span>
                      <div>{selectedReconciliation.bank_debtor_name || '-'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Input
                placeholder="Rechercher par référence ou titre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="max-h-96 overflow-y-auto space-y-2">
                {searchResults?.map((tx: any) => (
                  <Card
                    key={tx.id}
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleManualMatch(tx.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{tx.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Ref: {tx.payment_reference}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {tx.currency} {tx.price.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(tx.service_date), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {searchResults?.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune transaction trouvée
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
