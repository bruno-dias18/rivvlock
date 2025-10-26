import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Eye } from 'lucide-react';
import { KycStatusBadge } from './KycStatusBadge';
import { KycReviewDialog } from './KycReviewDialog';
import { KycStatusRecord, KycDocument } from '@/types';
import { UseMutationResult } from '@tanstack/react-query';

interface KycStatusCardProps {
  kycStatus: KycStatusRecord & { profiles: any };
  documents?: KycDocument[];
  verifyDocument: UseMutationResult<void, Error, { documentId: string; verified: boolean }, unknown>;
  updateStatus: UseMutationResult<void, Error, { userId: string; status: string; notes?: string }, unknown>;
  onSelectUser: (userId: string) => void;
}

export function KycStatusCard({ 
  kycStatus, 
  documents, 
  verifyDocument, 
  updateStatus,
  onSelectUser 
}: KycStatusCardProps) {
  const profile = kycStatus.profiles as any;
  const displayName = profile?.company_name || 
    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
    'Utilisateur sans nom';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{displayName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {profile?.user_type} • {profile?.country}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <KycStatusBadge status={kycStatus.status} />
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectUser(kycStatus.user_id)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Examiner
                </Button>
              </DialogTrigger>
              <KycReviewDialog
                displayName={displayName}
                documents={documents}
                verifyDocument={verifyDocument}
                updateStatus={updateStatus}
                userId={kycStatus.user_id}
              />
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Créé le {new Date(kycStatus.created_at).toLocaleDateString()}
          {kycStatus.notes && (
            <p className="mt-2 text-foreground">
              <strong>Notes:</strong> {kycStatus.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
