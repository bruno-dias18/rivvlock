import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  CreditCard, 
  Smartphone, 
  QrCode, 
  ExternalLink, 
  Clock, 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';

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
}

export const PaymentLink = () => {
  const { token } = useParams<{ token: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const { formatAmount } = useCurrency();
  const { toast } = useToast();
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

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('shared_link_token', token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          variant: 'destructive',
          title: 'Lien invalide',
          description: 'Ce lien de paiement n\'existe pas ou a expiré.',
        });
        navigate('/');
        return;
      }

      setTransaction(data);
      updateCountdown();
    } catch (error) {
      console.error('Error fetching transaction:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les détails de la transaction.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (!transaction?.payment_deadline) return;

    const deadline = new Date(transaction.payment_deadline);
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
      console.log('⚠️ ALERT: Payment deadline in less than 24 hours!');
      // Mock notification - in real app this would trigger email/SMS
    }
  };

  const handlePaymentMethod = (method: string) => {
    setSelectedPaymentMethod(method);
    setShowPaymentDialog(true);
  };

  const processPayment = async () => {
    if (!transaction || !selectedPaymentMethod) return;

    setIsProcessingPayment(true);
    
    try {
      // Mock payment processing - simulate delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { error } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          payment_method: selectedPaymentMethod,
          payment_blocked_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (error) throw error;

      // Mock notifications
      console.log('📧 EMAIL: Payment blocked successfully!');
      console.log('📱 SMS: Funds secured for transaction', transaction.title);

      toast({
        title: 'Paiement bloqué !',
        description: 'Les fonds ont été sécurisés. Le vendeur sera notifié.',
      });

      setShowPaymentDialog(false);
      fetchTransaction(); // Refresh transaction data

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de paiement',
        description: 'Impossible de traiter le paiement. Veuillez réessayer.',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const getPaymentMethods = () => [
    {
      id: 'card',
      name: 'Carte bancaire',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Visa, Mastercard, American Express'
    },
    {
      id: 'stripe',
      name: 'Stripe Payment',
      icon: <ExternalLink className="w-5 h-5" />,
      description: 'Paiement sécurisé via Stripe'
    },
    {
      id: 'bank_transfer',
      name: 'Virement bancaire',
      icon: <CreditCard className="w-5 h-5" />,
      description: 'Virement SEPA ou Swift'
    },
    {
      id: 'twint',
      name: 'Twint',
      icon: <Smartphone className="w-5 h-5" />,
      description: 'Paiement mobile suisse'
    },
    {
      id: 'qr_code',
      name: 'QR Code',
      icon: <QrCode className="w-5 h-5" />,
      description: 'Scan pour payer'
    }
  ];

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

  const canPay = !isExpired && transaction.status === 'pending' && !transaction.payment_blocked_at;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl gradient-text">{transaction.title}</CardTitle>
              <Badge variant={transaction.status === 'paid' ? 'default' : 'secondary'}>
                {transaction.status === 'paid' ? 'Payé' : 'En attente'}
              </Badge>
            </div>
            <CardDescription>
              Transaction sécurisée via RIVVLOCK Escrow
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
              </div>
              <div>
                <h3 className="font-medium mb-1">Date de service</h3>
                <p className="text-muted-foreground">
                  {format(new Date(transaction.service_date), 'PPP', { locale: fr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Status */}
        {transaction.status === 'paid' ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Paiement effectué</strong> - Les fonds ont été bloqués avec succès le{' '}
              {transaction.payment_blocked_at && format(new Date(transaction.payment_blocked_at), 'PPP à HH:mm', { locale: fr })}
              {transaction.payment_method && ` via ${transaction.payment_method}`}.
            </AlertDescription>
          </Alert>
        ) : (
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
        )}

        {/* Payment Methods */}
        {canPay && (
          <Card>
            <CardHeader>
              <CardTitle>Bloquer les fonds</CardTitle>
              <CardDescription>
                Choisissez votre méthode de paiement pour sécuriser cette transaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {getPaymentMethods().map((method) => (
                  <Button
                    key={method.id}
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => handlePaymentMethod(method.id)}
                  >
                    <div className="flex items-center gap-3">
                      {method.icon}
                      <div className="text-left">
                        <div className="font-medium">{method.name}</div>
                        <div className="text-sm text-muted-foreground">{method.description}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Processing Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer le paiement</DialogTitle>
              <DialogDescription>
                Vous allez bloquer {formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')} via{' '}
                {getPaymentMethods().find(m => m.id === selectedPaymentMethod)?.name}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {selectedPaymentMethod === 'qr_code' && (
                <div className="text-center p-8 bg-accent rounded-lg">
                  <QrCode className="w-24 h-24 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">QR Code Placeholder</p>
                </div>
              )}
              
              {selectedPaymentMethod === 'stripe' && (
                <div className="p-4 bg-accent rounded-lg">
                  <p className="text-sm text-muted-foreground text-center">
                    Redirection vers Stripe... (Mock)
                  </p>
                </div>
              )}
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPaymentDialog(false)}
                  className="flex-1"
                  disabled={isProcessingPayment}
                >
                  Annuler
                </Button>
                <Button 
                  onClick={processPayment} 
                  className="flex-1 gradient-primary text-white"
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? 'Traitement...' : 'Confirmer le paiement'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};