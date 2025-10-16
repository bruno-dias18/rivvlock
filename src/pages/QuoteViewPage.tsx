import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ArrowLeft, MessageSquare, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { QuoteMessaging } from '@/components/QuoteMessaging';
import { toast } from 'sonner';
import { useAttachQuote } from '@/hooks/useAttachQuote';
import { logger } from '@/lib/logger';

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

export const QuoteViewPage = () => {
  const { quoteId, token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutateAsync: attachQuote } = useAttachQuote();
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [emailMismatchInfo, setEmailMismatchInfo] = useState<{
    clientEmail: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!quoteId || !token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }

    fetchQuote();

    // Check if we should open messaging (from redirect)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openMessage') === 'true' && user) {
      setMessagingOpen(true);
      // Clean URL
      window.history.replaceState({}, '', `/quote/${quoteId}/${token}`);
    }
  }, [quoteId, token, user]);

  const fetchQuote = async () => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-quote-by-token', {
        body: { quote_id: quoteId, secure_token: token }
      });

      if (fetchError) throw fetchError;

      if (!data || !data.success) {
        setError(data?.error || 'Erreur lors de la récupération du devis');
      } else if (data.quote) {
        setQuoteData(data.quote);
        
        // Vérifier si l'utilisateur est connecté avec le bon email
        if (user && data.quote.client_email && user.email !== data.quote.client_email) {
          setEmailMismatchInfo({
            clientEmail: data.quote.client_email,
            message: `Ce devis a été envoyé à ${data.quote.client_email}. Veuillez vous connecter avec cette adresse.`
          });
        }
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

  const handleAcceptQuote = async () => {
    if (!user) {
      toast.error('Vous devez être connecté pour accepter un devis');
      navigate(`/auth?redirect=/quote/${quoteId}/${token}`);
      return;
    }

    if (!quoteId || !token) {
      toast.error('Informations du devis manquantes');
      return;
    }

    // Vérifier l'email AVANT d'accepter
    if (user && quoteData?.client_email && user.email !== quoteData.client_email) {
      setEmailMismatchInfo({
        clientEmail: quoteData.client_email,
        message: `Ce devis a été envoyé à ${quoteData.client_email}. Veuillez vous connecter avec cette adresse.`
      });
      return; // Bloquer l'acceptation
    }

    setIsAccepting(true);
    try {
      // First attach the quote to the user if not already done
      try {
        await attachQuote({ quoteId, token });
      } catch (err: any) {
        // Check for email mismatch - block acceptance
        if (err.error === 'email_mismatch' || err.message?.includes('email_mismatch')) {
          setEmailMismatchInfo({
            clientEmail: err.client_email || quoteData?.client_email || '',
            message: err.message
          });
          return; // Stop here, don't proceed with acceptance
        }
        // For other errors, continue (might be "already attached")
      }
      
      const { data, error } = await supabase.functions.invoke('accept-quote', {
        body: { quoteId, token }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Devis accepté avec succès ! Redirection vers la transaction...');
      setTimeout(() => {
        navigate('/transactions');
      }, 1500);
    } catch (err: any) {
      logger.error('Error accepting quote:', err);
      toast.error(err.message || 'Erreur lors de l\'acceptation du devis');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleOpenMessaging = async () => {
    if (!user) {
      toast.error('Vous devez être connecté pour envoyer un message');
      navigate(`/auth?redirect=/quote/${quoteId}/${token}&openMessage=true`);
      return;
    }

    // Vérifier l'email AVANT d'ouvrir le Dialog
    if (user && quoteData?.client_email && user.email !== quoteData.client_email) {
      setEmailMismatchInfo({
        clientEmail: quoteData.client_email,
        message: `Ce devis a été envoyé à ${quoteData.client_email}. Veuillez vous connecter avec cette adresse.`
      });
      return; // Bloquer l'ouverture
    }
    
    // Try to attach the quote first if not already done
    if (token) {
      try {
        await attachQuote({ quoteId: quoteId!, token });
      } catch (err: any) {
        // Check for email mismatch - block messaging (fallback)
        if (err.error === 'email_mismatch' || err.message?.includes('email_mismatch')) {
          setEmailMismatchInfo({
            clientEmail: err.client_email || quoteData?.client_email || '',
            message: err.message
          });
          return; // Stop here, don't open messaging
        }
        // Continue for other errors (might already be attached or user is seller)
        logger.error('Error attaching quote:', err);
      }
    }
    
    setMessagingOpen(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement du devis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erreur</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!quoteData) return null;

  const statusInfo = statusConfig[quoteData.status] || statusConfig.pending;
  const isExpired = quoteData.status === 'expired' || new Date(quoteData.valid_until) < new Date();
  const isEmailMismatch = !!emailMismatchInfo;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Email Mismatch Warning Banner */}
        {emailMismatchInfo && (
          <div className="bg-warning/10 border-b border-warning">
            <div className="container mx-auto p-4 max-w-4xl">
              <Alert variant="destructive" className="border-warning bg-warning/20">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <AlertTitle className="text-foreground">⚠️ Attention : Adresse email différente</AlertTitle>
                <AlertDescription className="space-y-3 text-foreground/90">
                  <div className="space-y-2">
                    <p>Ce devis a été envoyé à : <strong>{emailMismatchInfo.clientEmail}</strong></p>
                    <p>Vous êtes connecté avec : <strong>{user?.email}</strong></p>
                  </div>
                  <p className="text-sm">
                    Pour accepter ou discuter de ce devis, veuillez vous reconnecter avec l'adresse email destinataire.
                  </p>
                  <Button
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate(`/auth?redirect=/quote/${quoteId}/${token}`);
                    }}
                    variant="default"
                    size="sm"
                    className="mt-2"
                  >
                    Se reconnecter avec le bon compte
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        <div className="container mx-auto p-6 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{quoteData.title}</CardTitle>
                {quoteData.description && (
                  <p className="text-sm text-muted-foreground">{quoteData.description}</p>
                )}
              </div>
              <Badge className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Seller Info */}
            <div>
              <h3 className="font-semibold mb-2">Vendeur</h3>
              <p className="text-sm">{quoteData.seller_name}</p>
            </div>

            {/* Client Info */}
            <div>
              <h3 className="font-semibold mb-2">Client</h3>
              <div className="text-sm space-y-1">
                {quoteData.client_name && <p><strong>Nom:</strong> {quoteData.client_name}</p>}
                <p><strong>Email:</strong> {quoteData.client_email}</p>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-3">Détails de la prestation</h3>
              <div className="space-y-2">
                {quoteData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantité: {item.quantity} × {item.unit_price.toFixed(2)} {quoteData.currency.toUpperCase()}
                      </p>
                    </div>
                    <p className="font-semibold">{item.total.toFixed(2)} {quoteData.currency.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sous-total:</span>
                <span>{quoteData.subtotal.toFixed(2)} {quoteData.currency.toUpperCase()}</span>
              </div>
              {quoteData.tax_rate && quoteData.tax_amount && (
                <div className="flex justify-between text-sm">
                  <span>TVA ({quoteData.tax_rate}%):</span>
                  <span>{quoteData.tax_amount.toFixed(2)} {quoteData.currency.toUpperCase()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total TTC:</span>
                <span>{quoteData.total_amount.toFixed(2)} {quoteData.currency.toUpperCase()}</span>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {quoteData.service_date && (
                <div>
                  <p className="font-semibold">Date de début:</p>
                  <p className="text-muted-foreground">
                    {format(new Date(quoteData.service_date), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}
              {quoteData.service_end_date && (
                <div>
                  <p className="font-semibold">Date de fin:</p>
                  <p className="text-muted-foreground">
                    {format(new Date(quoteData.service_end_date), 'dd MMMM yyyy', { locale: fr })}
                  </p>
                </div>
              )}
              <div>
                <p className="font-semibold">Valide jusqu'au:</p>
                <p className="text-muted-foreground">
                  {format(new Date(quoteData.valid_until), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div>
                <p className="font-semibold">Créé le:</p>
                <p className="text-muted-foreground">
                  {format(new Date(quoteData.created_at), 'dd MMMM yyyy', { locale: fr })}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            {['pending', 'negotiating'].includes(quoteData.status) && !isExpired && (
              <>
                <Separator />
                <div className="flex gap-3 flex-col sm:flex-row">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex-1">
                        <Button 
                          className="w-full"
                          size="lg"
                          onClick={handleAcceptQuote}
                          disabled={isAccepting || isEmailMismatch}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          {isAccepting ? 'Acceptation...' : 'Accepter le devis'}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {isEmailMismatch && (
                      <TooltipContent>
                        <p>Connectez-vous avec {emailMismatchInfo.clientEmail} pour accepter ce devis</p>
                      </TooltipContent>
                    )}
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex-1">
                        <Button 
                          variant="outline"
                          className="w-full"
                          size="lg"
                          onClick={handleOpenMessaging}
                          disabled={isEmailMismatch}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Poser une question
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {isEmailMismatch && (
                      <TooltipContent>
                        <p>Connectez-vous avec {emailMismatchInfo.clientEmail} pour discuter de ce devis</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quote Messaging Dialog */}
        {quoteId && (
          <QuoteMessaging
            quoteId={quoteId}
            token={token}
            open={messagingOpen}
            onOpenChange={setMessagingOpen}
            clientName={quoteData.client_name || undefined}
          />
        )}
      </div>
      </div>
    </TooltipProvider>
  );
};

export default QuoteViewPage;