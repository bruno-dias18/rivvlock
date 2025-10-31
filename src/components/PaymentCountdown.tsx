import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PaymentCountdownProps {
  paymentDeadline: string;
  className?: string;
  label?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export function PaymentCountdown({ paymentDeadline, className, label }: PaymentCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const deadline = new Date(paymentDeadline);
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
  }, [paymentDeadline]);

  if (isExpired) {
    return (
      <div className={cn("flex items-center gap-2 text-destructive", className)}>
        <AlertTriangle className="h-4 w-4" />
        <Badge variant="destructive" className="font-normal">
          Délai de paiement expiré
        </Badge>
      </div>
    );
  }

  // Determine urgency level
  const hoursRemaining = Math.floor(timeRemaining.total / (1000 * 60 * 60));
  let urgencyLevel: 'safe' | 'warning' | 'critical' = 'safe';
  let badgeVariant: 'default' | 'secondary' | 'destructive' = 'default';

  if (hoursRemaining < 24) {
    urgencyLevel = 'critical';
    badgeVariant = 'destructive';
  } else if (hoursRemaining < 48) {
    urgencyLevel = 'warning';
    badgeVariant = 'secondary';
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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <Badge variant={badgeVariant} className="font-normal">
          {formatTimeRemaining()} pour payer
        </Badge>
        <div className="text-xs text-muted-foreground">
          {label && <span className="font-medium">{label} - </span>}
          Avant le {new Date(paymentDeadline).toLocaleDateString('fr-FR')} à {new Date(paymentDeadline).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}