import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@radix-ui/react-collapsible';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIsMobile } from '@/lib/mobileUtils';

interface DisputeContentProps {
  transaction: any;
  dispute: any;
  isTransactionDetailsOpen: boolean;
  setIsTransactionDetailsOpen: (open: boolean) => void;
  isDisputeMessageExpanded: boolean;
  setIsDisputeMessageExpanded: (open: boolean) => void;
  getDisputeTypeText: (type: string) => string;
}

export const DisputeContent = ({
  transaction,
  dispute,
  isTransactionDetailsOpen,
  setIsTransactionDetailsOpen,
  isDisputeMessageExpanded,
  setIsDisputeMessageExpanded,
  getDisputeTypeText
}: DisputeContentProps) => {
  const isMobile = useIsMobile();

  return (
    <>
      {/* Transaction Details */}
      {!dispute.status.startsWith('resolved') && (
        <Collapsible open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
          <div className="bg-muted/50 rounded-lg">
            <CollapsibleTrigger asChild>
              <button className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/70 transition-colors rounded-lg">
                <h4 className="font-medium text-sm">Détails de la transaction</h4>
                {isMobile && (
                  isTransactionDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="px-3 pb-3">
                {isMobile ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="font-medium">
                        {transaction.price} {transaction.currency?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Statut:</span>
                      <Badge variant="outline" className="text-xs">
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Montant:</span>
                      <span className="ml-2 font-medium">
                        {transaction.price} {transaction.currency?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date du service:</span>
                      <span className="ml-2">
                        {transaction.service_date 
                          ? format(new Date(transaction.service_date), 'dd/MM/yyyy', { locale: fr })
                          : 'Non définie'
                        }
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vendeur:</span>
                      <span className="ml-2">{transaction.seller_display_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Acheteur:</span>
                      <span className="ml-2">{transaction.buyer_display_name || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Dispute Information */}
      {!dispute.status.startsWith('resolved') && (
        <Collapsible open={isDisputeMessageExpanded} onOpenChange={setIsDisputeMessageExpanded}>
          <div>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <h4 className="font-medium text-sm">Type: {getDisputeTypeText(dispute.dispute_type)}</h4>
                  </div>
                  {isMobile && (
                    isDisputeMessageExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </button>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Message initial du client:</strong>
                </p>
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {isMobile && !isDisputeMessageExpanded && dispute.reason.length > 100
                    ? `${dispute.reason.substring(0, 100)}...`
                    : dispute.reason
                  }
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Signalé le {format(new Date(dispute.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
              </p>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </>
  );
};
