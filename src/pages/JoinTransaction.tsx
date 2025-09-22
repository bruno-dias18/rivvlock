import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Shield, Users, CreditCard, AlertTriangle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Transaction {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  service_date: string | null;
  user_id: string;
  buyer_id: string | null;
  status: string;
  payment_deadline: string | null;
  link_expires_at: string | null;
}

export const JoinTransaction = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransaction = useCallback(async () => {
    if (!token || token === ':token') {
      setError('Lien invalide - token manquant ou exemple');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 [JOIN] Fetching transaction with token:', token);
      
      const { data, error } = await supabase.functions.invoke('get-transaction-by-token', {
        body: { token }
      });

      console.log('🔍 [JOIN] Function response:', { data, error });

      if (error) {
        console.error('❌ [JOIN] Edge function error:', error);
        setError(`Erreur de fonction: ${error.message}`);
        return;
      }

      if (!data) {
        console.error('❌ [JOIN] No data received');
        setError('Aucune donnée reçue du serveur');
        return;
      }

      if (!data.success || !data.transaction) {
        console.error('❌ [JOIN] Invalid response:', data);
        setError(data.error || 'Transaction non trouvée ou token invalide');
        return;
      }

      setTransaction(data.transaction);
      setError(null); // Clear any previous errors
      console.log('✅ [JOIN] Transaction loaded successfully');
    } catch (error) {
      console.error('❌ [JOIN] Error fetching transaction:', error);
      setError(error instanceof Error ? error.message : 'Impossible de charger la transaction');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    console.log('[JOIN] Loading page with token:', token);
    fetchTransaction();
  }, [fetchTransaction]);

  // Handle redirect to payment if user is already the buyer
  useEffect(() => {
    if (user && transaction && transaction.buyer_id === user.id) {
      console.log('🔄 [JOIN] User is already buyer, redirecting to payment');
      navigate(`/payment-link/${token}`);
    }
  }, [user, transaction, token, navigate]);

  const handleJoinTransaction = async () => {
    if (!user || !transaction) return;

    // Check if user is the seller
    if (user.id === transaction.user_id) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Vous ne pouvez pas rejoindre votre propre transaction'
      });
      return;
    }

    // Check if already joined
    if (transaction.buyer_id === user.id) {
      navigate(`/payment-link/${token}`);
      return;
    }

    setIsJoining(true);
    try {
      const { error } = await supabase.functions.invoke('join-transaction', {
        body: { 
          transaction_id: transaction.id,
          token: token
        }
      });

      if (error) throw error;

      console.log('✅ [JOIN] Successfully joined transaction');
      toast({
        title: 'Transaction rejointe !',
        description: 'Vous pouvez maintenant procéder au paiement sécurisé.'
      });

      // Redirect to payment page
      navigate(`/payment-link/${token}`);
    } catch (error) {
      console.error('❌ [JOIN] Error joining transaction:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de rejoindre la transaction. Veuillez réessayer.'
      });
    } finally {
      setIsJoining(false);
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getPaymentDeadline = () => {
    if (!transaction?.payment_deadline) return null;
    const deadline = new Date(transaction.payment_deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expiré';
    if (diffDays === 1) return 'Demain';
    return `${diffDays} jours`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Chargement de la transaction...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!transaction && !loading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Transaction non trouvée
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <h3 className="font-semibold text-orange-800 dark:text-orange-400 mb-2">
                  🔗 Lien invalide ou expiré
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {error || 'Cette transaction n\'existe pas, le lien a expiré, ou vous n\'avez pas les autorisations nécessaires pour y accéder.'}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Que faire maintenant ?</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Vérifiez que le lien est correct et complet</li>
                  <li>• Contactez la personne qui vous a envoyé le lien</li>
                  <li>• Demandez un nouveau lien de paiement</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => navigate('/')} 
                  className="flex-1"
                  variant="outline"
                >
                  Retour à l'accueil
                </Button>
                <Button 
                  onClick={() => fetchTransaction()} 
                  className="flex-1 gradient-primary text-white"
                >
                  Réessayer
                </Button>
              </div>
              
              {/* Fallback button to continue to payment if user has the token */}
              {token && token !== ':token' && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Vous avez déjà un compte et voulez continuer le paiement ?
                  </p>
                  <Button 
                    onClick={() => navigate(`/payment-link/${token}`)} 
                    variant="secondary"
                    className="w-full"
                  >
                    Continuer vers le paiement
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Don't render main content if transaction is null
  if (!transaction) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold gradient-text">Connexion RIVVLOCK</h1>
          <p className="text-muted-foreground mt-1">
            Connectez-vous pour accéder à cette transaction sécurisée
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {transaction.title}
            </CardTitle>
            <CardDescription>
              Transaction escrow sécurisée avec RIVVLOCK
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Transaction Details */}
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <h3 className="font-semibold mb-2">Description du service</h3>
                <p className="text-sm">{transaction.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Montant</span>
                  </div>
                  <div className="text-xl font-bold gradient-text">
                    {formatCurrency(transaction.price, transaction.currency)}
                  </div>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Date de service</span>
                  </div>
                  <div className="text-sm font-semibold">
                    {transaction.service_date 
                      ? format(new Date(transaction.service_date), 'dd MMMM yyyy', { locale: fr })
                      : 'Non spécifiée'
                    }
                  </div>
                </div>
              </div>

              {transaction.payment_deadline && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium">Délai de paiement</span>
                    <Badge variant="outline" className="ml-auto">
                      {getPaymentDeadline()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Le paiement doit être effectué avant le {format(new Date(transaction.payment_deadline), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                  </p>
                </div>
              )}
            </div>

            {/* Security Features */}
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-400">Protection escrow</span>
              </div>
              <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                <li>• Fonds sécurisés jusqu'à validation mutuelle</li>
                <li>• Remboursement automatique en cas de problème</li>
                <li>• Système de dispute intégré</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {!user ? (
                <div className="text-center space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">
                      🔐 Connexion RIVVLOCK requise
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Pour accéder à cette transaction sécurisée, vous devez vous connecter ou créer un compte RIVVLOCK.
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(`/auth?redirect=/join-transaction/${token}`)} 
                    className="w-full gradient-primary text-white"
                    size="lg"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Se connecter à RIVVLOCK
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Nouveau chez RIVVLOCK ? Un compte sera créé automatiquement.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                    <h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">
                      ✅ Connecté à RIVVLOCK
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Vous pouvez maintenant procéder au paiement sécurisé.
                    </p>
                  </div>
                  <Button 
                    onClick={handleJoinTransaction}
                    disabled={isJoining}
                    className="w-full gradient-primary text-white"
                    size="lg"
                  >
                    {isJoining ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Préparation du paiement...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4 mr-2" />
                        Procéder au paiement
                      </>
                    )}
                  </Button>
                  
                  {/* Alternative fallback button */}
                  <Button 
                    onClick={() => navigate(`/payment-link/${token}`)}
                    variant="secondary"
                    className="w-full"
                  >
                    Continuer vers le paiement
                  </Button>
                </div>
              )}
              
              <Button 
                onClick={() => navigate('/')} 
                variant="outline" 
                className="w-full"
              >
                Retour à l'accueil
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};