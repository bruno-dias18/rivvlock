import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Elements } from '@stripe/react-stripe-js';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  Users
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { stripePromise } from '@/lib/stripe';
import { StripePaymentForm, AlternativePaymentMethods } from '@/components/escrow/StripePaymentForm';
import { TransactionChat } from '@/components/escrow/TransactionChat';
import { ValidationButtons } from '@/components/escrow/ValidationButtons';
import { PaymentWindow } from '@/components/validation/PaymentWindow';
import { DisputeForm } from '@/components/escrow/DisputeForm';

interface Transaction {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  service_date: string;
  payment_deadline: string;
  status: string;
  user_id: string;
  buyer_id: string | null;
  payment_method: string | null;
  payment_blocked_at: string | null;
  stripe_payment_intent_id: string | null;
  seller_validated: boolean;
  buyer_validated: boolean;
  validation_deadline: string | null;
  funds_released: boolean;
  dispute_id: string | null;
}

export const PaymentLink = () => {
  const { token } = useParams<{ token: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/');
      return;
    }
    fetchTransaction();
  }, [token]);

  useEffect(() => {
    if (transaction?.payment_deadline) {
      const timer = setInterval(() => {
        updateCountdown();
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [transaction]);

  const fetchTransaction = async () => {
    if (!token) return;

    console.log('🔍 [PAYMENT-LINK] Token reçu:', token);
    console.log('🔍 [PAYMENT-LINK] URL actuelle:', window.location.href);

    try {
      // Use the public edge function to fetch transaction data
      const { data, error } = await supabase.functions.invoke('get-transaction-by-token', {
        body: { token }
      });

      if (error) {
        console.error('❌ [PAYMENT-LINK] Edge function error:', error);
        throw error;
      }

      if (!data.success || !data.transaction) {
        throw new Error('Transaction non trouvée ou token invalide');
      }

      const transactionData = data.transaction;
      console.log('✅ [PAYMENT-LINK] Transaction trouvée:', transactionData);
      console.log('👤 [PAYMENT-LINK] Current user:', user?.id);
      console.log('🛒 [PAYMENT-LINK] Buyer assigned:', transactionData.buyer_id);

      setTransaction(transactionData);
      updateCountdown(transactionData);
    } catch (error: any) {
      console.error('❌ [PAYMENT-LINK] Erreur lors de la récupération de la transaction:', error);
      
      // Don't redirect to '/' on auth errors - just show appropriate UI
      if (error.message?.includes('Token')) {
        setTransaction(null);
      } else {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || 'Transaction non trouvée'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = (txData = transaction) => {
    if (!txData?.payment_deadline) return;

    const deadline = new Date(txData.payment_deadline);
    const now = new Date();
    
    if (now > deadline) {
      setIsExpired(true);
      setCountdown('Délai expiré');
      return;
    }

    const days = differenceInDays(deadline, now);
    const hours = differenceInHours(deadline, now) % 24;
    const minutes = differenceInMinutes(deadline, now) % 60;
    
    if (days > 0) {
      setCountdown(`${days}j ${hours}h`);
    } else if (hours > 0) {
      setCountdown(`${hours}h ${minutes}m`);
    } else {
      setCountdown(`${minutes}m`);
    }

    // Show 24h warning
    const totalHours = differenceInHours(deadline, now);
    if (totalHours <= 24 && totalHours > 0) {
      console.log('Test: PaymentWindow - Payment deadline in less than 24 hours!');
    }
  };

  const handleStripePayment = async () => {
    if (!transaction || !user) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          transactionId: transaction.id,
          paymentMethod: 'stripe'
        }
      });

      if (error) throw error;

      setClientSecret(data.clientSecret);
      setShowStripeForm(true);

      // Update transaction with buyer_id if not set
      if (!transaction.buyer_id) {
        await supabase
          .from('transactions')
          .update({ buyer_id: user.id })
          .eq('id', transaction.id);
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer l\'intention de paiement.',
      });
    }
  };

  const refreshTransaction = () => {
    fetchTransaction();
  };

  // Check user access
  const isParticipant = user && (user.id === transaction?.user_id || user.id === transaction?.buyer_id);
  const canPay = !isExpired && transaction && transaction.status === 'pending' && !transaction.payment_blocked_at;

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!transaction) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto mt-8">
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Transaction introuvable</h2>
              <p className="text-muted-foreground">Ce lien de paiement n'existe pas ou a expiré.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl gradient-text">{transaction.title}</CardTitle>
              <div className="flex gap-2">
                <Badge variant={
                  transaction.status === 'validated' ? 'default' :
                  transaction.status === 'paid' ? 'secondary' :
                  transaction.status === 'disputed' ? 'destructive' : 'outline'
                }>
                   {transaction.status === 'validated' ? 'Terminé' :
                    transaction.status === 'paid' ? 'Fonds bloqués' :
                   transaction.status === 'disputed' ? 'En litige' : 'En attente'}
                </Badge>
                {transaction.funds_released && (
                  <Badge variant="default" className="bg-green-600">
                    Fonds libérés
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription>
              Transaction sécurisée via RIVVLOCK Escrow • Frais de service : 5%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{transaction.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium mb-1">Montant</h3>
                <p className="text-2xl font-bold gradient-text">
                  {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}
                </p>
                {transaction.status === 'paid' && (
                  <p className="text-sm text-muted-foreground">
                    Vendeur recevra : {formatAmount(transaction.price * 0.95, transaction.currency as 'EUR' | 'CHF')}
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-medium mb-1">Date de service</h3>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.service_date), 'PPP', { locale: fr })}
                </p>
              </div>
            </div>

            {/* Participants */}
            {(transaction.buyer_id || isParticipant) && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  <h3 className="font-medium">Participants</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Vendeur : </span>
                    <span>{user?.id === transaction.user_id ? 'Vous' : 'Autre partie'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acheteur : </span>
                    <span>
                      {transaction.buyer_id 
                        ? (user?.id === transaction.buyer_id ? 'Vous' : 'Autre partie')
                        : 'En attente'
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content - Different views based on transaction status and user access */}
        {!user ? (
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
              <p className="text-muted-foreground mb-4">
                Vous devez être connecté pour accéder à cette transaction.
              </p>
              <Button onClick={() => navigate(`/join-transaction/${token}`)}>
                Rejoindre la transaction
              </Button>
            </CardContent>
          </Card>
        ) : !transaction.buyer_id ? (
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Rejoignez d'abord la transaction</h2>
              <p className="text-muted-foreground mb-4">
                Vous devez d'abord rejoindre cette transaction avant de pouvoir payer.
              </p>
              <Button onClick={() => navigate(`/join-transaction/${token}`)}>
                Rejoindre la transaction
              </Button>
            </CardContent>
          </Card>
        ) : transaction.buyer_id !== user.id ? (
          <Card>
            <CardContent className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Accès non autorisé</h2>
              <p className="text-muted-foreground mb-4">
                Cette transaction est assignée à un autre utilisateur.
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                Retour à l'accueil
              </Button>
            </CardContent>
          </Card>
        ) : transaction.status === 'pending' ? (
          // Payment phase
          <>
            {/* Payment Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Délai de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isExpired ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Délai expiré</strong> - Le paiement devait être effectué avant la veille de la date de service.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Temps restant :</span>
                      <Badge variant="outline" className="font-mono text-lg">
                        {countdown}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Paiement à effectuer avant le{' '}
                      {format(new Date(transaction.payment_deadline), 'PPP à HH:mm', { locale: fr })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            {canPay && (
              <Tabs defaultValue="stripe" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stripe">Paiement par carte</TabsTrigger>
                  <TabsTrigger value="alternative">Autres méthodes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="stripe" className="space-y-4">
                  {showStripeForm && clientSecret ? (
                    <Elements stripe={stripePromise} options={{ clientSecret }}>
                      <StripePaymentForm
                        transaction={transaction}
                        clientSecret={clientSecret}
                        onSuccess={refreshTransaction}
                      />
                    </Elements>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>Paiement sécurisé</CardTitle>
                        <CardDescription>
                          Bloquez {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')} de manière sécurisée
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={handleStripePayment}
                          className="w-full gradient-primary text-white"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Continuer avec Stripe
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="alternative">
                  <AlternativePaymentMethods transaction={transaction} />
                </TabsContent>
              </Tabs>
            )}
          </>
        ) : (
          // Post-payment phase (paid, completed, disputed)
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="chat">
                <MessageSquare className="w-4 h-4 mr-1" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="dispute">Litige</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Payment Status */}
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Paiement effectué</strong> - Les fonds ont été bloqués avec succès le{' '}
                  {transaction.payment_blocked_at && format(new Date(transaction.payment_blocked_at), 'PPP à HH:mm', { locale: fr })}
                  {transaction.payment_method && ` via ${transaction.payment_method}`}.
                </AlertDescription>
              </Alert>

              {/* Validation Status Overview */}
              {transaction.validation_deadline && (
                <Card>
                  <CardHeader>
                    <CardTitle>Statut de validation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-sm font-medium mb-1">Vendeur</p>
                        <Badge variant={transaction.seller_validated ? 'default' : 'secondary'}>
                          {transaction.seller_validated ? 'Validé ✓' : 'En attente'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium mb-1">Acheteur</p>
                        <Badge variant={transaction.buyer_validated ? 'default' : 'secondary'}>
                          {transaction.buyer_validated ? 'Validé ✓' : 'En attente'}
                        </Badge>
                      </div>
                    </div>
                    
                    {transaction.funds_released && (
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Fonds libérés !</strong> La transaction a été complétée avec succès.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="chat">
              <TransactionChat
                transactionId={transaction.id}
                sellerId={transaction.user_id}
                buyerId={transaction.buyer_id}
              />
            </TabsContent>

            <TabsContent value="validation">
              <ValidationButtons
                transaction={transaction}
                onValidationUpdate={refreshTransaction}
              />
            </TabsContent>

            <TabsContent value="dispute">
              {transaction.dispute_id ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Litige en cours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Un litige est en cours d'examen par notre équipe d'arbitrage. 
                        Vous recevrez une réponse sous 48h.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              ) : (
                <DisputeForm
                  transactionId={transaction.id}
                  onDisputeCreated={refreshTransaction}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
};