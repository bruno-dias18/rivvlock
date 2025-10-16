import { MessageSquare, Clock, AlertTriangle } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DisputeHeaderProps {
  disputeId: string;
  transactionTitle: string;
  unreadMessages: number;
  timeRemaining: { hours: number; minutes: number } | null;
  isExpired: boolean;
  status: string;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
}

export const DisputeHeader = ({
  disputeId,
  transactionTitle,
  unreadMessages,
  timeRemaining,
  isExpired,
  status,
  getStatusColor,
  getStatusText
}: DisputeHeaderProps) => {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <CardTitle className="text-sm md:text-lg flex items-center gap-2 flex-wrap">
          <MessageSquare className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
          <span className="truncate">Litige #{disputeId.slice(0, 8)}</span>
          {unreadMessages > 0 && (
            <Badge 
              variant="destructive" 
              className="text-xs flex-shrink-0"
            >
              {unreadMessages}
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs md:text-sm text-muted-foreground mt-1 truncate">
          {transactionTitle}
        </p>
        {timeRemaining && !isExpired && !status.startsWith('resolved') && (
          <div className="flex items-center gap-1 mt-2 text-orange-600 dark:text-orange-400">
            <Clock className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium truncate">
              {timeRemaining.hours}h {timeRemaining.minutes}min restantes pour la résolution amiable
            </span>
          </div>
        )}
        {isExpired && (
          <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium truncate">
              Escaladé au support client pour arbitrage
            </span>
          </div>
        )}
      </div>
      <Badge className={`${getStatusColor(status)} flex-shrink-0 text-xs whitespace-nowrap`}>
        {getStatusText(status)}
      </Badge>
    </div>
  );
};
