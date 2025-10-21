import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, MessageCircle, CheckCircle, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/hooks/useToast';
import { QuoteMessaging } from '@/components/QuoteMessaging';

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface QuoteData {
  id: string;
  title: string;
  description: string;
  items: QuoteItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  service_date?: string;
  service_end_date?: string;
  valid_until: string;
  status: string;
  client_name: string;
  client_email?: string;
  seller_name: string;
  created_at: string;
  conversation_id?: string;
}

export default function QuoteViewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }

    fetchQuote();
  }, [token]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      setError('');

      // Extract quote_id from URL if present (format: /quote-view/:token?quoteId=xxx)
      const searchParams = new URLSearchParams(window.location.search);
      const quoteId = searchParams.get('quoteId');

      if (!quoteId) {
        throw new Error('ID du devis manquant');
      }

      const { data, error: fetchError } = await supabase.functions.invoke('get-quote-by-token', {
        body: {
          quote_id: quoteId,
          secure_token: token
        }
      });

      if (fetchError) throw fetchError;

      if (data?.quote) {
        setQuote(data.quote);
      } else {
        throw new Error('Devis non trouvé');
      }
    } catch (err: any) {
      logger.error('Error fetching quote:', err);
      setError(err.message || 'Erreur lors du chargement du devis');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscuss = async () => {
    if (!user) {
      toast.info('Veuillez vous connecter pour discuter du devis');
      navigate(`/auth?redirect=/quote-view/${token}?quoteId=${quote?.id}`);
      return;
    }

    if (!quote) return;

    // ✅ Si conversation existe déjà, ouvrir directement
    if (quote.conversation_id) {
      setMessagingOpen(true);
      return;
    }

    // ✅ Sinon, créer/récupérer la conversation via edge function
    try {
      const { data, error } = await supabase.functions.invoke('get-or-create-quote-conversation', {
        body: { quoteId: quote.id }
      });

      if (error) throw error;

      if (data?.conversation_id) {
        // Mettre à jour le quote local avec le conversation_id
        setQuote({ ...quote, conversation_id: data.conversation_id });
        setMessagingOpen(true);
      }
    } catch (err: any) {
      logger.error('Error creating conversation:', err);
      toast.error('Impossible d\'ouvrir la messagerie');
    }
  };

  const handleAccept = async () => {
    if (!user) {
      toast.info('Veuillez vous connecter pour accepter le devis');
      navigate(`/auth?redirect=/quote-view/${token}?quoteId=${quote?.id}`);
      return;
    }

    if (!quote) return;

    try {
      setProcessing(true);

      const { data, error } = await supabase.functions.invoke('accept-quote', {
        body: {
          quoteId: quote.id,
          token: token
        }
      });

      if (error) throw error;

      if (data?.transaction) {
        toast.success('Devis accepté ! Redirection vers vos transactions...', {
          description: 'Vous pouvez maintenant payer la transaction'
        });
        navigate('/dashboard?tab=pending');
      }
    } catch (err: any) {
      logger.error('Error accepting quote:', err);
      toast.error(err.message || 'Erreur lors de l\'acceptation du devis');
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Erreur</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const isExpired = new Date(quote.valid_until) < new Date();
  const canAccept = quote.status === 'pending' && !isExpired;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 py-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation button */}
        {user && (
          <div className="flex justify-start">
            <Button
              variant="outline"
              onClick={() => navigate('/quotes')}
              className="gap-2"
            >
              ← Mes devis
            </Button>
          </div>
        )}

        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{quote.title}</CardTitle>
                <CardDescription>
                  Devis de <span className="font-medium">{quote.seller_name}</span>
                </CardDescription>
              </div>
              <Badge variant={canAccept ? 'default' : 'secondary'}>
                {quote.status === 'accepted' && 'Accepté'}
                {quote.status === 'rejected' && 'Refusé'}
                {quote.status === 'expired' && 'Expiré'}
                {quote.status === 'pending' && !isExpired && 'En attente'}
                {quote.status === 'pending' && isExpired && 'Expiré'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Description */}
        {quote.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{quote.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détails du devis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {quote.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start pb-2 border-b last:border-0">
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} × {item.unit_price.toFixed(2)} {quote.currency.toUpperCase()}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {item.total.toFixed(2)} {quote.currency.toUpperCase()}
                  </p>
                </div>
              ))}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{quote.subtotal.toFixed(2)} {quote.currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({quote.tax_rate}%)</span>
                  <span>{quote.tax_amount.toFixed(2)} {quote.currency.toUpperCase()}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{quote.total_amount.toFixed(2)} {quote.currency.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        {(quote.service_date || quote.service_end_date) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Dates & heures de prestation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quote.service_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Début :</span>
                    <span className="font-medium">
                      {format(new Date(quote.service_date), 'PPP', { locale: fr })}
                      {new Date(quote.service_date).getHours() !== 0 && (
                        <span className="ml-2 text-primary">
                          à {format(new Date(quote.service_date), 'HH:mm')}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {quote.service_end_date && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Fin :</span>
                    <span className="font-medium">
                      {format(new Date(quote.service_end_date), 'PPP', { locale: fr })}
                      {new Date(quote.service_end_date).getHours() !== 0 && (
                        <span className="ml-2 text-primary">
                          à {format(new Date(quote.service_end_date), 'HH:mm')}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validité */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Valide jusqu'au {format(new Date(quote.valid_until), 'PPP', { locale: fr })}
              </p>
              {isExpired && (
                <Badge variant="destructive">Expiré</Badge>
              )}
            </div>
            {isExpired && (
              <p className="text-sm text-muted-foreground mt-3">
                ⚠️ Ce devis a expiré. Contactez le vendeur pour obtenir un nouveau devis ou prolonger la validité.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleDiscuss}
                variant="outline"
                className="flex-1"
                disabled={!user}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Discuter
              </Button>
              <Button
                onClick={handleAccept}
                variant="default"
                className="flex-1"
                disabled={!user || !canAccept || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Traitement...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accepter le devis
                  </>
                )}
              </Button>
            </div>
            {!user && canAccept && (
              <div className="space-y-3 mt-4">
                <p className="text-sm text-muted-foreground text-center">
                  💡 Vous devez être connecté pour discuter ou accepter ce devis
                </p>
                <Button
                  onClick={() => navigate(`/auth?redirect=/quote-view/${token}?quoteId=${quote?.id}`)}
                  variant="outline"
                  className="w-full"
                >
                  Se connecter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Messagerie unifiée */}
      {quote && quote.conversation_id && (
        <QuoteMessaging
          quoteId={quote.id}
          token={token}
          open={messagingOpen}
          onOpenChange={setMessagingOpen}
          clientName={quote.client_name}
        />
      )}
    </>
  );
}
