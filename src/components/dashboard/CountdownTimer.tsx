import { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { Clock, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CountdownTimerProps {
  targetDate: string;
  label: string;
  onExpired?: () => void;
  showAlert?: boolean;
  className?: string;
}

export const CountdownTimer = ({ targetDate, label, onExpired, showAlert = false, className }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [showUrgentAlert, setShowUrgentAlert] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const target = new Date(targetDate);
      const now = new Date();
      
      if (now >= target) {
        setIsExpired(true);
        setTimeLeft('Expiré');
        if (onExpired) onExpired();
        return;
      }

      const days = differenceInDays(target, now);
      const hours = differenceInHours(target, now) % 24;
      const minutes = differenceInMinutes(target, now) % 60;
      const seconds = differenceInSeconds(target, now) % 60;

      // Show urgent alert if less than 24 hours
      if (days === 0 && hours < 24) {
        setShowUrgentAlert(true);
      }

      if (days > 0) {
        setTimeLeft(`${days}j ${hours}h ${minutes}min`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}min ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}min ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpired]);

  if (isExpired) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">Expiré</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {showUrgentAlert && showAlert && (
        <Alert className="mb-2 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Urgent !</strong> Moins de 24h restantes pour {label.toLowerCase()}
          </AlertDescription>
        </Alert>
      )}
      
      <div className={`flex items-center gap-2 ${showUrgentAlert ? 'text-yellow-600' : 'text-muted-foreground'}`}>
        <Clock className="w-4 h-4" />
        <span className="font-medium">
          {label}: {timeLeft}
        </span>
      </div>
    </div>
  );
};