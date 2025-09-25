import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ValidationActionButtonsProps {
  transaction: any;
  isUserBuyer: boolean;
  onTransferComplete: () => void;
  onOpenDispute: (transaction: any) => void;
  isMobile?: boolean;
  isValidationExpired?: boolean;
  CompleteButtonComponent: React.ComponentType<any>;
}

export function ValidationActionButtons({
  transaction,
  isUserBuyer,
  onTransferComplete,
  onOpenDispute,
  isMobile = false,
  isValidationExpired = false,
  CompleteButtonComponent
}: ValidationActionButtonsProps) {
  
  if (isValidationExpired) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        Délai de validation expiré - La transaction sera finalisée automatiquement
      </div>
    );
  }

  return (
    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-2'}`}>
      <CompleteButtonComponent
        transaction={transaction}
        onTransferComplete={onTransferComplete}
      />
      <Button
        variant="outline"
        size={isMobile ? "default" : "sm"}
        onClick={() => onOpenDispute(transaction)}
        className={`${isMobile ? "justify-center" : ""} border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground`}
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Déclarer un litige
      </Button>
    </div>
  );
}