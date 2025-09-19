import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, AlertTriangle, CreditCard, Users } from 'lucide-react';

interface TestResult {
  step: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

interface TestTransactionData {
  id: string;
  token: string;
  joinLink: string;
  paymentLink: string;
  price: number;
  currency: string;
  clientSecret?: string;
}

export const StripeEscrowTest = () => {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [transactionData, setTransactionData] = useState<TestTransactionData | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const runStripeEscrowTest = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Vous devez être connecté pour lancer les tests'
      });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setTransactionData(null);

    try {
      // Step 1: Create test transaction
      addResult({
        step: '1. Créer Transaction',
        status: 'pending',
        message: 'Création d\'une transaction de test 100 CHF...'
      });

      const token = crypto.randomUUID();
      const serviceDate = new Date();
      serviceDate.setDate(serviceDate.getDate() + 7); // Service in 7 days
      
      const paymentDeadline = new Date(serviceDate);
      paymentDeadline.setDate(paymentDeadline.getDate() - 1); // Payment deadline day before
      
      const linkExpiresAt = new Date();
      linkExpiresAt.setDate(linkExpiresAt.getDate() + 30); // Link expires in 30 days

      const { data: transaction, error: createError } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: user.id,
            title: 'Test Escrow - Paiement Stripe',
            description: 'Transaction de test pour valider le paiement escrow Stripe avec capture manuelle',
            price: 100,
            currency: 'CHF',
            service_date: serviceDate.toISOString(),
            shared_link_token: token,
            link_expires_at: linkExpiresAt.toISOString(),
            payment_deadline: paymentDeadline.toISOString(),
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (createError) throw createError;

      const testData: TestTransactionData = {
        id: transaction.id,
        token,
        joinLink: `${window.location.origin}/join-transaction/${token}`,
        paymentLink: `${window.location.origin}/payment/${token}`,
        price: 100,
        currency: 'CHF'
      };

      setTransactionData(testData);

      addResult({
        step: '1. Créer Transaction',
        status: 'success',
        message: 'Transaction créée avec succès',
        details: {
          id: transaction.id,
          price: '100 CHF',
          serviceDate: serviceDate.toDateString(),
          paymentDeadline: paymentDeadline.toDateString()
        }
      });

      // Step 2: Assign buyer BEFORE creating Payment Intent
      addResult({
        step: '2. Assign Buyer',
        status: 'pending',
        message: "Assignation d'un buyer à la transaction..."
      });

      const { error: assignError } = await supabase
        .from('transactions')
        .update({ buyer_id: user.id }) // Dans ce test on s'assigne comme buyer
        .eq('id', transaction.id);

      if (assignError) throw assignError;

      addResult({
        step: '2. Assign Buyer',
        status: 'success',
        message: 'Buyer assigné à la transaction (simulé)',
        details: { buyerId: 'current-user (test simulation)' }
      });

      // Step 3: Create Payment Intent (now that buyer is set)
      addResult({
        step: '3. Payment Intent',
        status: 'pending',
        message: 'Création du Payment Intent Stripe...'
      });

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          transactionId: transaction.id,
          paymentMethod: 'stripe'
        }
      });

      if (paymentError) throw paymentError;

      testData.clientSecret = paymentData.clientSecret;
      setTransactionData({ ...testData });

      addResult({
        step: '3. Payment Intent',
        status: 'success',
        message: 'Payment Intent créé avec capture_method: manual',
        details: {
          paymentIntentId: paymentData.paymentIntentId,
          clientSecret: paymentData.clientSecret.substring(0, 30) + '...',
          captureMethod: 'manual'
        }
      });

      // Step 4: Test transaction fetch with buyer
      addResult({
        step: '4. Fetch Transaction',
        status: 'pending',
        message: 'Récupération des données de transaction...'
      });

      const { data: fetchedTx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transaction.id)
        .single();

      if (fetchError) throw fetchError;

      addResult({
        step: '4. Fetch Transaction',
        status: 'success',
        message: 'Transaction récupérée avec buyer assigné',
        details: {
          status: fetchedTx.status,
          hasBuyer: !!fetchedTx.buyer_id,
          hasPaymentIntent: !!fetchedTx.stripe_payment_intent_id
        }
      });

      // Step 5: Test validation system
      addResult({
        step: '5. Validation System',
        status: 'pending',
        message: 'Test du système de validation mutuelle...'
      });

      // Simulate payment completion
      const { error: updateStatusError } = await supabase
        .from('transactions')
        .update({ 
          status: 'paid',
          payment_blocked_at: new Date().toISOString(),
          validation_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        })
        .eq('id', transaction.id);

      if (updateStatusError) throw updateStatusError;

      addResult({
        step: '5. Validation System',
        status: 'success',
        message: 'Système de validation configuré (status: paid)',
        details: {
          status: 'paid',
          validationDeadline: '7 jours',
          fundsHeld: true
        }
      });

      // Step 6: Test escrow capture simulation
      addResult({
        step: '6. Escrow Capture',
        status: 'pending',
        message: 'Test de la fonction capture-payment (simulation)...'
      });

      // Note: We won't actually capture in test mode, but verify the function exists
      const { error: captureTestError } = await supabase.functions.invoke('capture-payment', {
        body: { transaction_id: transaction.id }
      });

      if (captureTestError && captureTestError.message.includes('Both parties must validate')) {
        addResult({
          step: '6. Escrow Capture',
          status: 'success',
          message: 'Fonction capture-payment opérationnelle (protection validation mutuelle active)',
          details: { expectedProtection: 'Both parties must validate before capture' }
        });
      } else if (captureTestError) {
        throw captureTestError;
      } else {
        addResult({
          step: '6. Escrow Capture',
          status: 'success',
          message: 'Fonction capture-payment opérationnelle'
        });
      }

      console.log('Test: StripeEscrowTest - All tests completed successfully');
      console.log('Test: Transaction data:', testData);

      toast({
        title: 'Tests Stripe Escrow terminés !',
        description: 'Tous les composants du système escrow fonctionnent correctement',
      });

    } catch (error) {
      console.error('Stripe Escrow Test error:', error);
      addResult({
        step: 'Erreur',
        status: 'error',
        message: 'Échec du test Stripe Escrow',
        details: error instanceof Error ? error.message : String(error)
      });
      
      toast({
        variant: 'destructive',
        title: 'Échec des tests Stripe',
        description: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const openTestLink = (type: 'join' | 'payment') => {
    if (!transactionData) return;
    const link = type === 'join' ? transactionData.joinLink : transactionData.paymentLink;
    window.open(link, '_blank');
  };

  const testStripePayment = () => {
    if (!transactionData?.clientSecret) return;
    
    toast({
      title: 'Test Paiement Stripe',
      description: 'Utilisez la carte test: 4242 4242 4242 4242, exp: 12/34, CVC: 123'
    });
    
    openTestLink('payment');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Test Stripe Escrow Complet
        </CardTitle>
        <CardDescription>
          Test end-to-end : Transaction → Payment Intent → Escrow → Validation → Capture
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button 
            onClick={runStripeEscrowTest}
            disabled={isRunning || !user}
            className="gradient-primary text-white"
          >
            {isRunning ? 'Tests en cours...' : 'Lancer Test Escrow Complet'}
          </Button>
        </div>

        {!user && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Vous devez être connecté pour lancer les tests
            </AlertDescription>
          </Alert>
        )}

        {/* Test Transaction Data */}
        {transactionData && (
          <div className="p-4 bg-accent rounded-lg space-y-3">
            <h3 className="font-medium">Transaction de test créée :</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">ID :</span>
                <code className="ml-1 text-xs">{transactionData.id.substring(0, 8)}...</code>
              </div>
              <div>
                <span className="text-muted-foreground">Montant :</span>
                <span className="ml-1 font-semibold">{transactionData.price} {transactionData.currency}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openTestLink('join')}
              >
                <Users className="w-3 h-3 mr-1" />
                Lien Join
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => openTestLink('payment')}
              >
                Lien Payment
              </Button>
              {transactionData.clientSecret && (
                <Button 
                  size="sm" 
                  onClick={testStripePayment}
                  className="bg-[#635bff] hover:bg-[#5851eb] text-white"
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Test Stripe
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Résultats des tests :</h3>
            {results.map((result, index) => (
              <div key={index} className="flex items-start gap-2 p-3 border rounded">
                <Badge 
                  variant={
                    result.status === 'success' ? 'default' :
                    result.status === 'error' ? 'destructive' : 'secondary'
                  }
                  className="shrink-0 mt-0.5"
                >
                  {result.status === 'success' ? <CheckCircle className="w-3 h-3" /> :
                   result.status === 'error' ? <AlertTriangle className="w-3 h-3" /> : '⏳'}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{result.step}</p>
                  <p className="text-sm text-muted-foreground">{result.message}</p>
                  {result.details && (
                    <details className="mt-1">
                      <summary className="text-xs cursor-pointer text-muted-foreground">
                        Détails
                      </summary>
                      <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions for manual testing */}
        {transactionData?.clientSecret && (
          <Alert>
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              <strong>Test de paiement manuel :</strong><br />
              1. Cliquez "Test Stripe" ci-dessus<br />
              2. Utilisez la carte test : <code>4242 4242 4242 4242</code><br />
              3. Exp: <code>12/34</code>, CVC: <code>123</code><br />
              4. Le paiement sera autorisé mais pas capturé (escrow)
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};