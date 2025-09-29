import { AlertTriangle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ExpiredPaymentNotificationProps {
  userRole: 'seller' | 'buyer';
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function ExpiredPaymentNotification({ 
  userRole, 
  onDelete, 
  isDeleting = false 
}: ExpiredPaymentNotificationProps) {
  const { t } = useTranslation();

  return (
    <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
      <AlertTriangle className="h-4 w-4" />
      <div className="flex items-center justify-between w-full">
        <AlertDescription className="font-medium">
          {userRole === 'seller' 
            ? "Délai de paiement expiré - Transaction annulée"
            : "Votre délai de paiement a expiré - Transaction annulée"
          }
        </AlertDescription>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="ml-4 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {isDeleting ? 'Suppression...' : 'Supprimer'}
          </Button>
        )}
      </div>
    </Alert>
  );
}