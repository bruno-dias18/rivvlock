import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, Shield, Users, CreditCard, AlertTriangle } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { isObsoleteUrl, forceCorrectUrl } from '@/lib/appUrl';
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

interface Profile {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}

export const JoinTransaction = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { toast } = useToast();
const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [sellerProfile, setSellerProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  console.log('🔍 [JOIN] Component render with:', { 
    token, 
    hasUser: !!user, 
    userEmail: user?.email,
    loading, 
    error,
    transaction: transaction?.id 
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && isObsoleteUrl()) {
      console.warn('⚠️ [JOIN] Obsolete domain detected, redirecting to working domain...');
      forceCorrectUrl();
    }
  }, []);

  const fetchTransaction = useCallback(async () => {
    console.log('🔍 [JOIN] fetchTransaction called with token:', token);
    console.log('🔍 [JOIN] Current user:', user ? 'connected' : 'not connected');
    
    if (!token || token === ':token') {
      console.log('❌ [JOIN] Invalid token:', token);
      setError('Lien invalide - token manquant ou exemple');
      setLoading(false);
      return;
    }

    try {
      console.log('🔍 [JOIN] Fetching transaction with token:', token);
      
      // 1) Try via supabase.functions.invoke
      let responseData: any | null = null;
      const { data, error } = await supabase.functions.invoke('get-transaction-by-token', {
        body: { token }
      });
      
      console.log('🔍 [JOIN] Function response:', { data, error });

      if (!error && data && data.success && data.transaction) {
        responseData = data;
      } else {
        // 2) Fallback: direct fetch to Edge Function URL
        console.warn('⚠️ [JOIN] Falling back to direct fetch for get-transaction-by-token');
        const resp = await fetch('https://slthyxqruhfuyfmextwr.supabase.co/functions/v1/get-transaction-by-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const fallbackJson = await resp.json().catch(() => null);

        if (!resp.ok || !fallbackJson?.success) {
          console.error('❌ [JOIN] Fallback fetch failed:', { status: resp.status, body: fallbackJson });
          setError(fallbackJson?.error || `Erreur (${resp.status})`);
          return;
        }
        responseData = fallbackJson;
      }

setTransaction(responseData.transaction);
      setSellerProfile(responseData.seller_profile || null);
      
      // Check if the link has expired
      const transaction = responseData.transaction;
      if (transaction.shared_link_expires_at || transaction.link_expires_at) {
        const expirationDate = new Date(transaction.shared_link_expires_at || transaction.link_expires_at);
        const now = new Date();
        if (now > expirationDate) {
          console.warn('⚠️ [JOIN] Link has expired');
          setError('Ce lien d\'invitation a expiré. Veuillez demander un nouveau lien au vendeur.');
          setLoading(false);
          return;
        }
      }
      
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
    console.log('🔍 [JOIN] Component mounted/updated with:', { 
      token, 
      userConnected: !!user, 
      loading 
    });
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

  const handleInlineLogin = async (e?: any) => {
    e?.preventDefault?.();
    setLoginError(null);
    setLoginLoading(true);
    try {
      if (!email || !password) {
        setLoginError('Veuillez saisir votre email et votre mot de passe.');
        return;
      }
      const { error } = await login(email, password);
      if (error) {
        setLoginError(error.message || 'Connexion impossible.');
        return;
      }
      // Join immediately after successful login
      if (transaction) {
        const { error: joinError } = await supabase.functions.invoke('join-transaction', {
          body: { transaction_id: transaction.id, token }
        });
        if (joinError) {
          setLoginError(joinError.message || 'Impossible de rejoindre la transaction après connexion.');
          return;
        }
      }
      navigate(`/payment-link/${token}`);
    } catch (err: any) {
      setLoginError(err?.message || 'Erreur inconnue lors de la connexion.');
    } finally {
      setLoginLoading(false);
    }
  };
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

  const getSellerDisplayName = () => {
    if (!sellerProfile) return 'Vendeur';
    const name = sellerProfile.company_name || `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim();
    return name || 'Vendeur';
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
          <h1 className="text-3xl font-bold gradient-text">Transaction RIVVLOCK</h1>
          <p className="text-muted-foreground mt-1">
            Détails de la transaction sécurisée
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
            {/* Transaction Details - Always visible */}
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <h3 className="font-semibold mb-2">Description du service</h3>
                <p className="text-sm">{transaction.description || 'Aucune description fournie'}</p>
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

              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Vendeur</span>
                </div>
                <div className="text-sm font-semibold">
                  {getSellerDisplayName()}
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

            {/* Authentication & Action Section */}
            <div className="border-t pt-4">
              {!user ? (
                <div className="text-center space-y-3">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">
                      🔐 Connexion requise pour le paiement
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Pour procéder au paiement sécurisé, connectez-vous ou créez un compte RIVVLOCK.
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(`/auth?redirect=/join-transaction/${token}`)} 
                    className="w-full gradient-primary text-white"
                    size="lg"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Se connecter pour payer
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
            </div>
            
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full"
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};