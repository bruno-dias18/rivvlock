import { memo } from 'react';
import { Quote } from '@/types/quotes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Archive, Eye, MessageCircle, MessageCircleMore } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useUnreadConversationMessages } from '@/hooks/useUnreadConversationMessages';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface Props {
  quote: Quote;
  onView: (quote: Quote) => void;
  onArchive: (quoteId: string) => void;
  onOpenMessaging?: (quoteId: string, clientName?: string) => void;
  isSeller: boolean;
  onMarkAsViewed?: (quoteId: string) => void;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  negotiating: { label: 'En négociation', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepté', color: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-800' },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-600' },
};

const QuoteCardComponent = ({ quote, onView, onArchive, onOpenMessaging, isSeller, onMarkAsViewed }: Props) => {
  const { t } = useTranslation();
  const { unreadCount } = useUnreadConversationMessages(quote.conversation_id);
  const statusInfo = statusConfig[quote.status];
  const canArchive = ['refused', 'accepted', 'expired'].includes(quote.status);
  const hasMessages = quote.conversation_id && unreadCount >= 0;
  
  // Show "modified" indicator only if quote was updated after the client last viewed it
  const hasBeenModified = !isSeller && (
    !quote.client_last_viewed_at || 
    new Date(quote.updated_at).getTime() > new Date(quote.client_last_viewed_at).getTime()
  );

  const handleView = () => {
    // Mark as viewed when client opens the quote
    if (!isSeller && hasBeenModified && onMarkAsViewed) {
      onMarkAsViewed(quote.id);
    }
    onView(quote);
  };

  return (
    <Card className={cn(
      "hover:shadow-md transition-shadow",
      hasBeenModified && !isSeller && "border-2 border-blue-500 shadow-blue-100"
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-2 flex-wrap">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg break-words">{quote.title}</h3>
              </div>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
              {hasBeenModified && !isSeller && (
                <Badge className="bg-blue-100 text-blue-800 border border-blue-300">
                  Modifié
                </Badge>
              )}
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
            <div className="relative flex-1 sm:flex-initial">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleView();
                }}
                className={cn(
                  "w-full",
                  hasBeenModified && !isSeller && "border-blue-500 border-2 text-blue-600 hover:bg-blue-50"
                )}
              >
                <Eye className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Voir</span>
              </Button>
              {hasBeenModified && !isSeller && (
                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-1.5 py-0.5 text-[10px] hover:scale-110 transition-transform">
                  Nouveau
                </Badge>
              )}
            </div>
            {/* Masquer la messagerie pour les devis acceptés (conversation dans la transaction) */}
            {onOpenMessaging && quote.status !== 'accepted' && (
              <div className="relative flex-1 sm:flex-initial">
                <Button
                  size="sm"
                  variant={unreadCount > 0 ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMessaging(quote.id, quote.client_name || undefined);
                  }}
                  className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {hasMessages ? (
                    <MessageCircleMore className="h-4 w-4 sm:mr-2" />
                  ) : (
                    <MessageCircle className="h-4 w-4 sm:mr-2" />
                  )}
                  <span className="hidden sm:inline">
                    {hasMessages ? t('common.viewConversation', 'Voir la discussion') : t('common.contact', 'Contacter')}
                  </span>
                </Button>
                {unreadCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-red-500 text-white px-1.5 py-0.5 text-[10px] hover:scale-110 transition-transform">
                    {unreadCount}
                  </Badge>
                )}
              </div>
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

export const QuoteCard = memo(QuoteCardComponent);
