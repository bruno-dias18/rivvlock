import { Quote } from '@/types/quotes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Archive, Eye, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUnreadQuoteMessages } from '@/hooks/useUnreadQuoteMessages';

interface Props {
  quote: Quote;
  onView: (quote: Quote) => void;
  onArchive: (quoteId: string) => void;
  onOpenMessaging?: (quoteId: string, clientName?: string) => void;
  isSeller: boolean;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  negotiating: { label: 'En négociation', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepté', color: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-800' },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-600' },
};

export const QuoteCard = ({ quote, onView, onArchive, onOpenMessaging, isSeller }: Props) => {
  const { unreadCount } = useUnreadQuoteMessages(quote.id);
  const statusInfo = statusConfig[quote.status];
  const canArchive = ['refused', 'accepted', 'expired'].includes(quote.status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2 flex-wrap">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg break-words">{quote.title}</h3>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-[20px] flex items-center justify-center px-1.5 text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p className="truncate">
                <span className="font-medium">{isSeller ? 'Client:' : 'Devis reçu'}</span> {isSeller ? (quote.client_name || quote.client_email) : ''}
              </p>
              <p>
                <span className="font-medium">Montant:</span>{' '}
                <span className="text-base sm:text-lg font-bold text-foreground">
                  {quote.total_amount.toFixed(2)} {quote.currency.toUpperCase()}
                </span>
              </p>
              <p className="text-xs sm:text-sm">
                <span className="font-medium">Valide jusqu'au:</span>{' '}
                {format(new Date(quote.valid_until), 'dd/MM/yyyy')}
              </p>
              {quote.service_date && (
                <p className="text-xs sm:text-sm">
                  <span className="font-medium">Prestation:</span>{' '}
                  {format(new Date(quote.service_date), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onView(quote);
              }}
              className="flex-1 sm:flex-initial"
            >
              <Eye className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Voir</span>
            </Button>
            {onOpenMessaging && (
              <Button
                size="sm"
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMessaging(quote.id, quote.client_name || undefined);
                }}
                className="flex-1 sm:flex-initial"
              >
                <MessageSquare className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Messagerie</span>
              </Button>
            )}
            {canArchive && quote.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(quote.id);
                }}
                className="flex-1 sm:flex-initial"
              >
                <Archive className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Archiver</span>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
