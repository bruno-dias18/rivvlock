import React from 'react';
import { CheckCircle, Calendar } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateChangeAcceptedNotificationProps {
  transaction: any;
}

export const DateChangeAcceptedNotification: React.FC<DateChangeAcceptedNotificationProps> = ({
  transaction
}) => {
  // Only show for approved status (brief moment after approval before reset to 'none')
  if (transaction.date_change_status !== 'approved') {
    return null;
  }

  const serviceDate = transaction.service_date ? new Date(transaction.service_date) : null;

  return (
    <Alert className="border-green-200 bg-green-50/50 mb-4">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="text-green-800">
        <strong>Date acceptée !</strong> L'acheteur a validé la date de service
        {serviceDate && (
          <span className="block mt-1">
            <Calendar className="inline h-3 w-3 mr-1" />
            {format(serviceDate, 'PPPp', { locale: fr })}
          </span>
        )}
        <span className="block mt-1 text-sm">
          En attente du paiement de l'acheteur.
        </span>
      </AlertDescription>
    </Alert>
  );
};
