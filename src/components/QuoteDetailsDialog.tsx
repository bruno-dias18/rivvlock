import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Quote } from '@/types/quotes';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface Props {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  negotiating: { label: 'En négociation', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepté', color: 'bg-green-100 text-green-800' },
  refused: { label: 'Refusé', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expiré', color: 'bg-gray-100 text-gray-800' },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-600' },
};

export const QuoteDetailsDialog = ({ quote, open, onOpenChange }: Props) => {
  if (!quote) return null;

  const statusInfo = statusConfig[quote.status];
  const origin = window.location.origin;
  const quoteLink = `${origin}/quote/${quote.id}/${quote.secure_token}`;

  const copyLink = () => {
    navigator.clipboard.writeText(quoteLink);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{quote.title}</DialogTitle>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Info */}
          <div>
            <h3 className="font-semibold mb-2">Client</h3>
            <div className="text-sm space-y-1">
              {quote.client_name && <p><strong>Nom:</strong> {quote.client_name}</p>}
              <p><strong>Email:</strong> {quote.client_email}</p>
            </div>
          </div>

          {/* Description */}
          {quote.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{quote.description}</p>
            </div>
          )}

          <Separator />

          {/* Items */}
          <div>
            <h3 className="font-semibold mb-3">Détails de la prestation</h3>
            <div className="space-y-2">
              {quote.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantité: {item.quantity} × {item.unit_price.toFixed(2)} {quote.currency.toUpperCase()}
                    </p>
                  </div>
                  <p className="font-semibold">{item.total.toFixed(2)} {quote.currency.toUpperCase()}</p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sous-total:</span>
              <span>{quote.subtotal.toFixed(2)} {quote.currency.toUpperCase()}</span>
            </div>
            {quote.tax_rate && quote.tax_amount && (
              <div className="flex justify-between text-sm">
                <span>TVA ({quote.tax_rate}%):</span>
                <span>{quote.tax_amount.toFixed(2)} {quote.currency.toUpperCase()}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total TTC:</span>
              <span>{quote.total_amount.toFixed(2)} {quote.currency.toUpperCase()}</span>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            {quote.service_date && (
              <div>
                <p className="font-semibold">Date de début:</p>
                <p className="text-muted-foreground">
                  {format(new Date(quote.service_date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
            {quote.service_end_date && (
              <div>
                <p className="font-semibold">Date de fin:</p>
                <p className="text-muted-foreground">
                  {format(new Date(quote.service_end_date), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            )}
            <div>
              <p className="font-semibold">Valide jusqu'au:</p>
              <p className="text-muted-foreground">
                {format(new Date(quote.valid_until), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <div>
              <p className="font-semibold">Créé le:</p>
              <p className="text-muted-foreground">
                {format(new Date(quote.created_at), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
          </div>

          <Separator />

          {/* Share Link */}
          <div>
            <h3 className="font-semibold mb-2">Lien client</h3>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={quoteLink}
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-muted"
              />
              <Button variant="outline" onClick={copyLink}>
                Copier
              </Button>
              <Button variant="outline" size="icon" asChild>
                <a href={quoteLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Ce lien permet au client de consulter le devis et d'y répondre
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
