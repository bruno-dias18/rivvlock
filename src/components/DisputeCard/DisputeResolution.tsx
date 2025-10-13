import { CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import type { Dispute } from '@/types';

interface ResolutionDetails {
  proposalType: string;
  refundPercentage: number;
  buyerRefund: string;
  sellerReceived: string;
  currency: string;
}

interface DisputeResolutionProps {
  dispute: Dispute;
  resolutionDetails: ResolutionDetails | null;
  userRole: 'seller' | 'buyer' | 'reporter';
  isExpired: boolean;
  isDeleting: boolean;
  handleDeleteDispute: () => void;
}

export const DisputeResolution = ({
  dispute,
  resolutionDetails,
  userRole,
  isExpired,
  isDeleting,
  handleDeleteDispute
}: DisputeResolutionProps) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Resolved Summary */}
      {dispute.status.startsWith('resolved') && (
        <div className="space-y-3">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h4 className="font-medium">Litige résolu</h4>
            </div>
            
            <div className="space-y-2 text-sm">
              {resolutionDetails && (
                <>
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      {dispute.resolution?.includes('administratif') 
                        ? t('disputes.resolutionDetails.adminAgreement')
                        : t('disputes.resolutionDetails.agreementReached')
                      }
                    </p>
                    <p className="text-muted-foreground">
                      {t(`disputes.resolutionTypes.${resolutionDetails.proposalType}`)}
                      {resolutionDetails.refundPercentage > 0 && ` - ${resolutionDetails.refundPercentage}%`}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  {/* Buyer refund */}
                  {userRole === 'buyer' && parseFloat(resolutionDetails.buyerRefund) > 0 && (
                    <div className="bg-background/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground">{t('disputes.resolutionDetails.refundedToBuyer')}</p>
                      <p className="font-semibold text-green-600">
                        {resolutionDetails.buyerRefund} {resolutionDetails.currency}
                      </p>
                    </div>
                  )}
                  
                  {/* Seller received */}
                  {userRole === 'seller' && parseFloat(resolutionDetails.sellerReceived) > 0 && (
                    <div className="bg-background/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground">{t('disputes.resolutionDetails.receivedBySeller')}</p>
                      <p className="font-semibold text-green-600">
                        {resolutionDetails.sellerReceived} {resolutionDetails.currency}
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {dispute.resolved_at && (
                <p className="text-xs text-muted-foreground pt-1">
                  Résolu le {format(new Date(dispute.resolved_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          </div>
          
          {/* Archive button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteDispute}
            disabled={isDeleting}
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? "Archivage..." : "Archiver ce litige"}
          </Button>
        </div>
      )}

      {/* Escalated View */}
      {isExpired && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-purple-600" />
            <h4 className="font-medium text-sm">Litige escaladé au support</h4>
          </div>
          <p className="text-sm text-muted-foreground">
            Vous allez être contacté par les équipes de Rivvlock pour trouver une solution.
          </p>
          {dispute.escalated_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Escaladé le {format(new Date(dispute.escalated_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            </p>
          )}
        </div>
      )}

    </>
  );
};
