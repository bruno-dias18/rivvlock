import { Quote } from '@/types/quotes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Archive, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  quote: Quote;
  onView: (quote: Quote) => void;
  onArchive: (quoteId: string) => void;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  negotiating: { label: 'En négociation', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepté', color: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-800' },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-600' },
};

export const QuoteCard = ({ quote, onView, onArchive }: Props) => {
  const statusInfo = statusConfig[quote.status];
  const canArchive = ['refused', 'accepted', 'expired'].includes(quote.status);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(quote)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-lg">{quote.title}</h3>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Client:</span> {quote.client_name || quote.client_email}
              </p>
              <p>
                <span className="font-medium">Montant:</span>{' '}
                <span className="text-lg font-bold text-foreground">
                  {quote.total_amount.toFixed(2)} {quote.currency.toUpperCase()}
                </span>
              </p>
              <p>
                <span className="font-medium">Valide jusqu'au:</span>{' '}
                {format(new Date(quote.valid_until), 'PPP', { locale: fr })}
              </p>
              {quote.service_date && (
                <p>
                  <span className="font-medium">Prestation:</span>{' '}
                  {format(new Date(quote.service_date), 'PPP', { locale: fr })}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onView(quote);
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              Voir
            </Button>
            {canArchive && quote.status !== 'archived' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(quote.id);
                }}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archiver
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
