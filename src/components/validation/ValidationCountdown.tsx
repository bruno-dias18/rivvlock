import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ValidationCountdownProps {
  validationDeadline: string | null;
  serviceDate: string | null;
  userRole: 'seller' | 'buyer';
}

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export const ValidationCountdown: React.FC<ValidationCountdownProps> = ({ 
  validationDeadline, 
  serviceDate,
  userRole 
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ hours: 0, minutes: 0, seconds: 0, total: 0 });

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft => {
      const deadline = new Date(validationDeadline);
      const now = new Date();
      const difference = deadline.getTime() - now.getTime();

      if (difference > 0) {
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        return { hours, minutes, seconds, total: difference };
      }

      return { hours: 0, minutes: 0, seconds: 0, total: 0 };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [validationDeadline]);

  // Don't show for seller
  if (userRole === 'seller') return null;

  // Don't show if deadline has passed
  if (timeLeft.total <= 0) return null;

  const isUrgent = timeLeft.total < 6 * 60 * 60 * 1000; // Less than 6 hours
  const isCritical = timeLeft.total < 1 * 60 * 60 * 1000; // Less than 1 hour

  const getUrgencyColor = () => {
    if (isCritical) return 'text-destructive';
    if (isUrgent) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  const getBackgroundColor = () => {
    if (isCritical) return 'bg-destructive/10 border-destructive/20';
    if (isUrgent) return 'bg-amber-50 border-amber-200';
    return 'bg-muted/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <Card className={`${getBackgroundColor()} transition-colors duration-300`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {isCritical ? (
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <AlertTriangle className={`h-5 w-5 ${getUrgencyColor()}`} />
              </motion.div>
            ) : (
              <Clock className={`h-5 w-5 ${getUrgencyColor()}`} />
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-medium ${getUrgencyColor()}`}>
                  {isCritical 
                    ? "🚨 Libération automatique imminente" 
                    : isUrgent 
                    ? "⚠️ Temps limité pour valider" 
                    : "⏰ Délai de validation"
                  }
                </h4>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`text-2xl font-mono font-bold ${getUrgencyColor()}`}>
                  {timeLeft.hours.toString().padStart(2, '0')}:
                  {timeLeft.minutes.toString().padStart(2, '0')}:
                  {timeLeft.seconds.toString().padStart(2, '0')}
                </div>
                
                <div className="text-sm text-muted-foreground">
                  {isCritical 
                    ? "Les fonds seront libérés automatiquement dans moins d'1 heure"
                    : isUrgent
                    ? "Les fonds seront libérés automatiquement si vous ne validez pas"
                    : "Vous avez jusqu'à cette échéance pour valider la libération des fonds"
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};