import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { KycDocumentList } from './KycDocumentList';
import { KycDocument } from '@/types';
import { UseMutationResult } from '@tanstack/react-query';
import { toast } from 'sonner';

interface KycReviewDialogProps {
  displayName: string;
  documents?: KycDocument[];
  verifyDocument: UseMutationResult<void, Error, { documentId: string; verified: boolean }, unknown>;
  updateStatus: UseMutationResult<void, Error, { userId: string; status: string; notes?: string }, unknown>;
  userId: string;
}

export function KycReviewDialog({ 
  displayName, 
  documents, 
  verifyDocument, 
  updateStatus,
  userId 
}: KycReviewDialogProps) {
  const [reviewNotes, setReviewNotes] = useState('');

  const handleUpdateStatus = (status: string) => {
    if (status === 'rejected' && !reviewNotes) {
      toast.error('Veuillez ajouter une raison de rejet');
      return;
    }
    updateStatus.mutate({
      userId,
      status,
      notes: reviewNotes,
    });
  };

  return (
    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Vérification KYC - {displayName}</DialogTitle>
      </DialogHeader>

      <div className="space-y-6">
        {/* Documents */}
        <div>
          <h3 className="font-semibold mb-3">Documents téléchargés</h3>
          <KycDocumentList documents={documents} verifyDocument={verifyDocument} />
        </div>

        {/* Notes */}
        <div>
          <label className="font-semibold block mb-2">Notes internes</label>
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Ajouter des notes sur cette vérification..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleUpdateStatus('additional_info_required')}
            disabled={updateStatus.isPending}
          >
            <Clock className="h-4 w-4 mr-2" />
            Info supplémentaire
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleUpdateStatus('rejected')}
            disabled={updateStatus.isPending}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Rejeter
          </Button>
          <Button
            onClick={() => handleUpdateStatus('approved')}
            disabled={updateStatus.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approuver
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
