import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

interface ExpiredPaymentNotificationProps {
  userRole: 'seller' | 'buyer';
}

export function ExpiredPaymentNotification({ userRole }: ExpiredPaymentNotificationProps) {
  const { t } = useTranslation();

  return (
    <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="font-medium">
        {userRole === 'seller' 
          ? "Délai de paiement expiré - Transaction annulée"
          : "Votre délai de paiement a expiré - Transaction annulée"
        }
      </AlertDescription>
    </Alert>
  );
}