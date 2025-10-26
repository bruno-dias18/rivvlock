import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKycStatus } from '@/hooks/useKycStatus';
import { useAdyenPayoutAccount } from '@/hooks/useAdyenPayoutAccount';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';

const KYC_DOCUMENT_TYPES = [
  { value: 'id_front', label: 'Pièce d\'identité (recto)', required: true },
  { value: 'id_back', label: 'Pièce d\'identité (verso)', required: true },
  { value: 'bank_statement', label: 'Relevé bancaire', required: true },
  { value: 'business_registry', label: 'Extrait RC (entreprise)', required: false },
  { value: 'proof_of_address', label: 'Justificatif de domicile', required: false },
];

export default function SellerVerification() {
  const { user } = useAuth();
  const { kycStatus, documents, uploadDocument } = useKycStatus(user?.id);
  const { payoutAccounts, defaultAccount, addPayoutAccount } = useAdyenPayoutAccount(user?.id);
  
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    iban: '',
    bic: '',
    account_holder_name: '',
    bank_name: '',
    country: 'CH',
  });

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-success"><CheckCircle className="h-3 w-3 mr-1" /> Vérifié</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejeté</Badge>;
      case 'in_review':
        return <Badge className="bg-warning"><Clock className="h-3 w-3 mr-1" /> En cours</Badge>;
      case 'additional_info_required':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" /> Info requise</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> En attente</Badge>;
    }
  };

  const handleFileUpload = async (file: File, documentType: string) => {
    setUploadingDoc(documentType);
    try {
      await uploadDocument.mutateAsync({ file, documentType });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleBankAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      await addPayoutAccount.mutateAsync({
        user_id: user.id,
        ...bankFormData,
        is_default: true,
      });
      setShowBankForm(false);
      setBankFormData({
        iban: '',
        bic: '',
        account_holder_name: '',
        bank_name: '',
        country: 'CH',
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const isDocumentUploaded = (type: string) => {
    return documents?.some(doc => doc.document_type === type);
  };

  const requiredDocsUploaded = KYC_DOCUMENT_TYPES
    .filter(dt => dt.required)
    .every(dt => isDocumentUploaded(dt.value));

  return (
    <DashboardLayoutWithSidebar>
      <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Vérification vendeur</h1>
        <p className="text-muted-foreground">
          Complétez votre vérification pour accepter des paiements sans limite
        </p>
      </div>

      <Tabs defaultValue="kyc" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="kyc">
            <FileText className="h-4 w-4 mr-2" />
            Vérification KYC
          </TabsTrigger>
          <TabsTrigger value="bank">
            <CreditCard className="h-4 w-4 mr-2" />
            Compte bancaire
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-6">
          {/* Status Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Statut de vérification</CardTitle>
                  <CardDescription>
                    Votre statut actuel et les documents requis
                  </CardDescription>
                </div>
                {getStatusBadge(kycStatus?.status)}
              </div>
            </CardHeader>
            <CardContent>
              {kycStatus?.status === 'pending' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Limite actuelle : CHF 1'000/an</strong><br />
                    Complétez votre KYC pour débloquer les paiements illimités.
                  </AlertDescription>
                </Alert>
              )}

              {kycStatus?.status === 'rejected' && kycStatus.rejection_reason && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Vérification rejetée</strong><br />
                    {kycStatus.rejection_reason}
                  </AlertDescription>
                </Alert>
              )}

              {kycStatus?.status === 'additional_info_required' && (
                <Alert className="bg-warning/10 border-warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Informations supplémentaires requises</strong><br />
                    {kycStatus.notes || 'Veuillez vérifier vos documents.'}
                  </AlertDescription>
                </Alert>
              )}

              {kycStatus?.status === 'approved' && (
                <Alert className="bg-success/10 border-success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Compte vérifié ✓</strong><br />
                    Vous pouvez maintenant accepter des paiements sans limite.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Document Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Documents requis</CardTitle>
              <CardDescription>
                Téléchargez les documents suivants pour vérification (PDF, JPG, PNG max 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {KYC_DOCUMENT_TYPES.map((docType) => {
                const uploaded = isDocumentUploaded(docType.value);
                const doc = documents?.find(d => d.document_type === docType.value);
                
                return (
                  <div key={docType.value} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {uploaded ? (
                        doc?.verified ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <Clock className="h-5 w-5 text-warning" />
                        )
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {docType.label}
                          {docType.required && <span className="text-destructive ml-1">*</span>}
                        </p>
                        {uploaded && (
                          <p className="text-sm text-muted-foreground">
                            {doc?.verified ? '✓ Vérifié' : 'En cours de vérification'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      {uploaded ? (
                        <Badge variant="outline">Téléchargé</Badge>
                      ) : (
                        <div className="relative">
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            id={`upload-${docType.value}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 5 * 1024 * 1024) {
                                  toast.error('Fichier trop volumineux (max 5MB)');
                                  return;
                                }
                                handleFileUpload(file, docType.value);
                              }
                            }}
                            disabled={uploadingDoc === docType.value}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById(`upload-${docType.value}`)?.click()}
                            disabled={uploadingDoc === docType.value}
                          >
                            {uploadingDoc === docType.value ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                Upload...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Télécharger
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!requiredDocsUploaded && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Veuillez télécharger tous les documents marqués d'un astérisque (*) pour soumettre votre demande.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank" className="space-y-6">
          {/* Bank Account */}
          <Card>
            <CardHeader>
              <CardTitle>Compte bancaire</CardTitle>
              <CardDescription>
                Configurez votre IBAN pour recevoir les paiements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {defaultAccount ? (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        <span className="font-medium">Compte par défaut</span>
                      </div>
                      {defaultAccount.verified ? (
                        <Badge className="bg-success">
                          <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" /> En attente
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">IBAN:</span>
                        <span className="font-mono">{defaultAccount.iban}</span>
                      </div>
                      {defaultAccount.bic && (
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-muted-foreground">BIC:</span>
                          <span className="font-mono">{defaultAccount.bic}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Titulaire:</span>
                        <span>{defaultAccount.account_holder_name}</span>
                      </div>
                      {defaultAccount.bank_name && (
                        <div className="grid grid-cols-2 gap-2">
                          <span className="text-muted-foreground">Banque:</span>
                          <span>{defaultAccount.bank_name}</span>
                        </div>
                      )}
                    </div>

                    {!defaultAccount.verified && (
                      <Alert className="mt-4">
                        <Clock className="h-4 w-4" />
                        <AlertDescription>
                          Votre IBAN sera vérifié par notre équipe sous 24-48h.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setShowBankForm(!showBankForm)}
                  >
                    {showBankForm ? 'Annuler' : 'Modifier le compte'}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowBankForm(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Ajouter un compte bancaire
                </Button>
              )}

              {showBankForm && (
                <form onSubmit={handleBankAccountSubmit} className="space-y-4 mt-6">
                  <div>
                    <Label htmlFor="iban">IBAN *</Label>
                    <Input
                      id="iban"
                      value={bankFormData.iban}
                      onChange={(e) => setBankFormData({ ...bankFormData, iban: e.target.value.toUpperCase() })}
                      placeholder="CH93 0076 2011 6238 5295 7"
                      required
                      pattern="[A-Z]{2}[0-9]{2}[A-Z0-9]+"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bic">BIC / SWIFT (optionnel)</Label>
                    <Input
                      id="bic"
                      value={bankFormData.bic}
                      onChange={(e) => setBankFormData({ ...bankFormData, bic: e.target.value.toUpperCase() })}
                      placeholder="UBSWCHZH80A"
                    />
                  </div>

                  <div>
                    <Label htmlFor="account_holder_name">Nom du titulaire *</Label>
                    <Input
                      id="account_holder_name"
                      value={bankFormData.account_holder_name}
                      onChange={(e) => setBankFormData({ ...bankFormData, account_holder_name: e.target.value })}
                      placeholder="Jean Dupont"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bank_name">Nom de la banque (optionnel)</Label>
                    <Input
                      id="bank_name"
                      value={bankFormData.bank_name}
                      onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                      placeholder="UBS Switzerland AG"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={addPayoutAccount.isPending}>
                      {addPayoutAccount.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowBankForm(false)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayoutWithSidebar>
  );
}
