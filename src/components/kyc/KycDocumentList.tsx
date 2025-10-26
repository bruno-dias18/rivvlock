import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, Download } from 'lucide-react';
import { KycDocument } from '@/types';
import { UseMutationResult } from '@tanstack/react-query';

interface KycDocumentListProps {
  documents?: KycDocument[];
  verifyDocument: UseMutationResult<void, Error, { documentId: string; verified: boolean }, unknown>;
}

export function KycDocumentList({ documents, verifyDocument }: KycDocumentListProps) {
  if (!documents || documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucun document téléchargé</p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <p className="font-medium">{doc.document_type}</p>
              <p className="text-sm text-muted-foreground">
                {doc.file_name} • {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {doc.verified ? (
              <Badge className="bg-success">
                <CheckCircle className="h-3 w-3 mr-1" /> Vérifié
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => verifyDocument.mutate({ documentId: doc.id, verified: true })}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(doc.file_url, '_blank')}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
