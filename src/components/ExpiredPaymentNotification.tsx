import { AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ExpiredPaymentNotificationProps {
  userRole: 'seller' | 'buyer';
  onDelete?: () => void;
  onRenew?: () => void;
  isDeleting?: boolean;
  isRenewing?: boolean;
}

export function ExpiredPaymentNotification({ 
  userRole, 
  onDelete,
  onRenew,
  isDeleting = false,
  isRenewing = false
}: ExpiredPaymentNotificationProps) {
  const { t } = useTranslation();

  return (
    <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full min-w-0">
        <AlertDescription className="font-medium">
          {userRole === 'seller' 
            ? "Délai de paiement expiré - Transaction annulée"
            : "Votre délai de paiement a expiré - Transaction annulée"
          }
        </AlertDescription>
        <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
          {userRole === 'seller' && onRenew && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRenew}
              disabled={isRenewing}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground w-full sm:w-auto whitespace-nowrap"
            >
              {isRenewing ? 'Relance...' : 'Proposer nouvelle date'}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}