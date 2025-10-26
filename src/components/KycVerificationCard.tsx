import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKycStatus } from '@/hooks/useKycStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

const KYC_DOCUMENT_TYPES = [
  { value: 'id_front', label: 'Pièce d\'identité (recto)', required: true },
  { value: 'id_back', label: 'Pièce d\'identité (verso)', required: true },
  { value: 'bank_statement', label: 'Relevé bancaire', required: true },
  { value: 'business_registry', label: 'Extrait RC (entreprise)', required: false },
  { value: 'proof_of_address', label: 'Justificatif de domicile', required: false },
];

export function KycVerificationCard() {
  const { user } = useAuth();
  const { kycStatus, documents, uploadDocument } = useKycStatus(user?.id);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

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

  const isDocumentUploaded = (type: string) => {
    return documents?.some(doc => doc.document_type === type);
  };

  const requiredDocsUploaded = KYC_DOCUMENT_TYPES
    .filter(dt => dt.required)
    .every(dt => isDocumentUploaded(dt.value));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Vérification KYC</CardTitle>
          </div>
          {getStatusBadge(kycStatus?.status)}
        </div>
        <CardDescription>
          Complétez votre vérification pour accepter des paiements sans limite
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Alerts */}
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

        {/* Document Upload Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Documents requis</h4>
          {KYC_DOCUMENT_TYPES.map((docType) => {
            const uploaded = isDocumentUploaded(docType.value);
            const doc = documents?.find(d => d.document_type === docType.value);
            
            return (
              <div key={docType.value} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {uploaded ? (
                    doc?.verified ? (
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-warning flex-shrink-0" />
                    )
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {docType.label}
                      {docType.required && <span className="text-destructive ml-1">*</span>}
                    </p>
                    {uploaded && (
                      <p className="text-xs text-muted-foreground">
                        {doc?.verified ? '✓ Vérifié' : 'En cours'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {uploaded ? (
                    <Badge variant="outline" className="text-xs">OK</Badge>
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
                          <Clock className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
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
              <AlertDescription className="text-xs">
                Téléchargez tous les documents marqués d'un astérisque (*) pour soumettre votre demande.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
