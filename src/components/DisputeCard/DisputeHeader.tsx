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
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <CardTitle className="text-sm md:text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Litige #{disputeId.slice(0, 8)}
          {unreadMessages > 0 && (
            <Badge 
              variant="destructive" 
              className="ml-2 text-xs"
            >
              {unreadMessages}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {transactionTitle}
        </p>
        {timeRemaining && !isExpired && !status.startsWith('resolved') && (
          <div className="flex items-center gap-1 mt-2 text-orange-600 dark:text-orange-400 overflow-hidden">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium whitespace-nowrap">
              {timeRemaining.hours}h {timeRemaining.minutes}min restantes pour la résolution amiable
            </span>
          </div>
        )}
        {isExpired && (
          <div className="flex items-center gap-1 mt-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Escaladé au support client pour arbitrage
            </span>
          </div>
        )}
      </div>
      <Badge className={`${getStatusColor(status)} flex-shrink-0 text-xs md:text-sm`}>
        {getStatusText(status)}
      </Badge>
    </div>
  );
};
