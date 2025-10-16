import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, FileText, Calendar, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface QuoteData {
  id: string;
  title: string;
  description: string | null;
  items: QuoteItem[];
  subtotal: number;
  tax_rate: number | null;
  tax_amount: number | null;
  total_amount: number;
  currency: string;
  service_date: string | null;
  service_end_date: string | null;
  valid_until: string;
  status: string;
  client_name: string | null;
  client_email: string;
  seller_name: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'En attente', className: 'bg-yellow-500' },
  negotiating: { label: 'En négociation', className: 'bg-blue-500' },
  accepted: { label: 'Accepté', className: 'bg-green-500' },
  refused: { label: 'Refusé', className: 'bg-red-500' },
  expired: { label: 'Expiré', className: 'bg-gray-500' },
  archived: { label: 'Archivé', className: 'bg-gray-400' },
};

export default function QuoteViewPage() {
  const { quoteId, token } = useParams<{ quoteId: string; token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<QuoteData | null>(null);

  useEffect(() => {
    if (!quoteId || !token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }

    fetchQuote();
  }, [quoteId, token]);

  const fetchQuote = async () => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-quote-by-token', {
        body: { quote_id: quoteId, secure_token: token }
      });

      if (fetchError) {
        throw fetchError;
      }

      if (!data || !data.success) {
        setError(data?.error || 'Erreur lors de la récupération du devis');
      } else if (data.quote) {
        setQuote(data.quote);
      } else {
        setError('Données du devis manquantes');
      }
    } catch (err: any) {
      logger.error('Error fetching quote:', err);
      setError(err.message || 'Erreur lors de la récupération du devis');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Erreur</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const statusInfo = statusConfig[quote.status] || statusConfig.pending;
  const isExpired = quote.status === 'expired' || new Date(quote.valid_until) < new Date();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Devis</h1>
          </div>
          <p className="text-muted-foreground">
            De <span className="font-semibold">{quote.seller_name}</span>
          </p>
        </div>

        {/* Main Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{quote.title}</CardTitle>
                {quote.description && (
                  <CardDescription className="text-base">{quote.description}</CardDescription>
                )}
              </div>
              <Badge className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Client Info */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Informations client
              </h3>
              <div className="text-sm space-y-1">
                {quote.client_name && <p className="font-medium">{quote.client_name}</p>}
                <p className="text-muted-foreground">{quote.client_email}</p>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-4">Services</h3>
              <div className="space-y-3">
                {quote.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantité: {item.quantity} × {item.unit_price.toFixed(2)} {quote.currency}
                      </p>
                    </div>
                    <p className="font-semibold">
                      {item.total.toFixed(2)} {quote.currency}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Pricing */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span>{quote.subtotal.toFixed(2)} {quote.currency}</span>
              </div>
              {quote.tax_rate && quote.tax_amount && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({quote.tax_rate}%)</span>
                  <span>{quote.tax_amount.toFixed(2)} {quote.currency}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{quote.total_amount.toFixed(2)} {quote.currency}</span>
              </div>
            </div>

            {/* Dates */}
            {(quote.service_date || quote.service_end_date || quote.valid_until) && (
              <>
                <Separator />
                <div className="space-y-2 text-sm">
                  {quote.service_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Date de prestation:</span>
                      <span className="font-medium">
                        {format(new Date(quote.service_date), 'PPP', { locale: fr })}
                        {quote.service_end_date && 
                          ` - ${format(new Date(quote.service_end_date), 'PPP', { locale: fr })}`
                        }
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Valable jusqu'au:</span>
                    <span className={`font-medium ${isExpired ? 'text-destructive' : ''}`}>
                      {format(new Date(quote.valid_until), 'PPP', { locale: fr })}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            {quote.status === 'pending' && !isExpired && (
              <>
                <Separator />
                <div className="flex gap-3">
                  <Button asChild className="flex-1">
                    <a href={`mailto:${quote.seller_name.toLowerCase().replace(/\s/g, '')}?subject=Acceptation du devis - ${quote.title}`}>
                      Accepter le devis
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <a href={`mailto:${quote.seller_name.toLowerCase().replace(/\s/g, '')}?subject=Question sur le devis - ${quote.title}`}>
                      Poser une question
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Ces boutons ouvrent votre client email. Contactez directement le vendeur pour accepter ou discuter du devis.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link to="/">← Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
