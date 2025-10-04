import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SellerValidationCountdownProps {
  validationDeadline?: string;
  sellerValidationDeadline?: string;
  isUserSeller?: boolean;
  className?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function SellerValidationCountdown({ validationDeadline, sellerValidationDeadline, isUserSeller = false, className }: SellerValidationCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      // Priority: sellerValidationDeadline if provided, otherwise validationDeadline
      const deadlineStr = sellerValidationDeadline || validationDeadline;
      if (!deadlineStr) return;

      const deadline = new Date(deadlineStr);
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();

      if (difference <= 0) {
        setIsExpired(true);
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, total: difference });
      setIsExpired(false);
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [validationDeadline, sellerValidationDeadline]);

  const deadlineStr = sellerValidationDeadline || validationDeadline;
  if (!deadlineStr) return null;

  // Show different messages for seller validation deadline vs buyer validation deadline
  const isSellerDeadline = !!sellerValidationDeadline;

  if (isExpired) {
    if (isSellerDeadline) {
      return (
        <div className={cn("flex items-center gap-2 text-orange-600", className)}>
          <AlertTriangle className="h-4 w-4" />
          <Badge variant="destructive" className="font-normal">
            {isUserSeller ? "Votre délai de validation a expiré" : "Délai vendeur expiré - Vous pouvez maintenant valider"}
          </Badge>
        </div>
      );
    }
    return (
      <div className={cn("flex items-center gap-2 text-primary", className)}>
        <CheckCircle className="h-4 w-4" />
        <Badge variant="default" className="font-normal">
          Fonds libérés automatiquement
        </Badge>
      </div>
    );
  }

  // Determine urgency level
  const hoursRemaining = Math.floor(timeRemaining.total / (1000 * 60 * 60));
  let badgeVariant: 'default' | 'secondary' | 'destructive' = 'secondary';

  if (isSellerDeadline && isUserSeller) {
    // For seller with their deadline: urgent (red) if < 24h
    if (hoursRemaining < 24) {
      badgeVariant = 'destructive';
    }
  } else if (!isSellerDeadline) {
    // For buyer validation deadline: neutral
    if (hoursRemaining < 24) {
      badgeVariant = 'default';
    }
  }

  const formatTimeRemaining = () => {
    if (timeRemaining.days > 0) {
      return `${timeRemaining.days}j ${timeRemaining.hours}h ${timeRemaining.minutes}min`;
    } else if (timeRemaining.hours > 0) {
      return `${timeRemaining.hours}h ${timeRemaining.minutes}min`;
    } else {
      return `${timeRemaining.minutes}min ${timeRemaining.seconds}s`;
    }
  };

  const getMessage = () => {
    if (isSellerDeadline) {
      if (isUserSeller) {
        return `${formatTimeRemaining()} pour valider la livraison`;
      } else {
        return `${formatTimeRemaining()} avant activation automatique de votre délai`;
      }
    } else {
      return `${formatTimeRemaining()} avant libération automatique des fonds`;
    }
  };

  const getDetailMessage = () => {
    const deadline = new Date(deadlineStr);
    if (isSellerDeadline) {
      if (isUserSeller) {
        return `Si vous ne validez pas avant le ${deadline.toLocaleDateString('fr-FR')} à ${deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, le délai acheteur sera activé automatiquement`;
      } else {
        return `Si le vendeur ne valide pas avant le ${deadline.toLocaleDateString('fr-FR')} à ${deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}, vous pourrez valider la transaction`;
      }
    } else {
      return `Fonds libérés automatiquement le ${deadline.toLocaleDateString('fr-FR')} à ${deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <Badge variant={badgeVariant} className="font-normal">
          {getMessage()}
        </Badge>
        <div className="text-xs text-muted-foreground">
          {getDetailMessage()}
        </div>
      </div>
    </div>
  );
}
