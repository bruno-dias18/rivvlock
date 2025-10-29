import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle2, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { useBankStatements, useUploadBankStatement } from '@/hooks/useBankStatements';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminBankReconciliation() {
  const navigate = useNavigate();
  const { data: statements, isLoading } = useBankStatements();
  const uploadMutation = useUploadBankStatement();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xml')) {
      toast.error('Seuls les fichiers XML sont acceptés (camt.053/054)');
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" />Complété</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En cours</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Échoué</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReconciliationBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Réconcilié</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">En cours</Badge>;
      case 'not_started':
        return <Badge variant="outline">Non démarré</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Réconciliation Bancaire</h1>
            <p className="text-muted-foreground">
              Import et rapprochement des relevés bancaires (camt.053/054)
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload">Import</TabsTrigger>
          <TabsTrigger value="statements">Relevés importés</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Importer un relevé bancaire</CardTitle>
              <CardDescription>
                Glissez-déposez ou sélectionnez un fichier XML au format camt.053 ou camt.054
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-border'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  Glissez-déposez votre fichier XML ici
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Formats supportés: camt.053, camt.054
                </p>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                  disabled={uploadMutation.isPending}
                />
                <label htmlFor="file-upload">
                  <Button asChild disabled={uploadMutation.isPending}>
                    <span>
                      {uploadMutation.isPending ? 'Import en cours...' : 'Sélectionner un fichier'}
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>1.</strong> Téléchargez votre relevé bancaire au format camt.053 ou camt.054
                depuis votre e-banking Valiant
              </p>
              <p>
                <strong>2.</strong> Importez le fichier XML via le formulaire ci-dessus
              </p>
              <p>
                <strong>3.</strong> Le système va automatiquement rapprocher les paiements avec les
                transactions RivvLock en utilisant les références QR (27 chiffres)
              </p>
              <p>
                <strong>4.</strong> Les transactions non réconciliées automatiquement pourront être
                rapprochées manuellement
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Chargement...</p>
              </CardContent>
            </Card>
          ) : statements?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Aucun relevé bancaire importé</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {statements?.map((statement) => (
                <Card
                  key={statement.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/admin/bank-reconciliation/${statement.id}`)}
                >
                  <CardContent className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">{statement.file_name}</h3>
                        {getStatusBadge(statement.status)}
                        {getReconciliationBadge(statement.reconciliation_status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Date: {format(new Date(statement.statement_date), 'dd/MM/yyyy')}</span>
                        <span>IBAN: {statement.account_iban}</span>
                        <span>
                          {statement.reconciled_count} réconciliées / {statement.unreconciled_count}{' '}
                          en attente
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {statement.currency} {statement.closing_balance?.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">Solde de clôture</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
