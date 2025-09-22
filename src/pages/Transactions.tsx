import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTransactions } from '@/hooks/useTransactions';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  CreditCard,
  ExternalLink,
  Link,
  Copy,
  User,
  RefreshCw,
  Timer,
  Banknote,
  CheckCheck,
  Download,
  Flag
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAppBaseUrl } from '@/lib/appUrl';
import { supabase } from '@/integrations/supabase/client';
import { generateSellerInvoice, generateBuyerInvoice, downloadInvoice } from '@/components/invoice/AutoInvoiceGenerator';
import { DisputeModal } from '@/components/escrow/DisputeModal';

// Remove mock transactions data - now using real data from useTransactions hook

export const Transactions = () => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { transactions, loading, error, refreshTransactions, getCounterpartyDisplayName } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [validatingTransactions, setValidatingTransactions] = useState<Set<string>>(new Set());
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeTransactionId, setDisputeTransactionId] = useState<string | null>(null);
  const [disputeRole, setDisputeRole] = useState<'seller' | 'buyer' | null>(null);
  const { toast } = useToast();
  const hasAutoSyncedRef = useRef(false);

  // Silent sync function for automatic synchronization
  const syncWithStripesilent = async () => {
    try {
      console.log('🔄 [AUTO-SYNC] Running automatic Stripe sync...');
      await supabase.functions.invoke('sync-stripe-payments');
      refreshTransactions();
    } catch (error) {
      console.error('❌ [AUTO-SYNC] Failed:', error);
    }
  };

  // Auto-sync on page load (once)
  useEffect(() => {
    if (!hasAutoSyncedRef.current && transactions.length >= 0) {
      hasAutoSyncedRef.current = true;
      syncWithStripesilent();
    }
  }, [transactions]);

  // Auto-sync when switching to "Bloquée" (paid) tab
  useEffect(() => {
    if (statusFilter === 'paid' && hasAutoSyncedRef.current) {
      console.log('🔄 [AUTO-SYNC] User clicked on Bloquée tab, syncing...');
      syncWithStripesilent();
    }
  }, [statusFilter]);

  const copyInvitationLink = async (token: string) => {
    try {
      const invitationLink = `${getAppBaseUrl()}/payment-link/${token}`;
      await navigator.clipboard.writeText(invitationLink);
      toast({
        title: "Lien copié !",
        description: "Le lien d'invitation a été copié dans le presse-papiers.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  const handleSellerValidation = async (transactionId: string) => {
    setValidatingTransactions(prev => new Set(prev).add(transactionId));
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-seller', {
        body: { transactionId }
      });

      if (error) throw error;

      toast({
        title: "Travail finalisé",
        description: "Votre validation a été enregistrée. En attente de la validation de l'acheteur.",
      });

      refreshTransactions();
    } catch (error: any) {
      console.error('Error validating seller:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la validation",
        variant: "destructive",
      });
    } finally {
      setValidatingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleFundsRelease = async (transactionId: string) => {
    setValidatingTransactions(prev => new Set(prev).add(transactionId));
    
    try {
      const { data, error } = await supabase.functions.invoke('capture-payment', {
        body: { transactionId }
      });

      if (error) throw error;

      if (data.funds_captured === false) {
        toast({
          title: "Validation enregistrée",
          description: data.message || "En attente de la validation du vendeur.",
        });
      } else {
        toast({
          title: "Fonds libérés",
          description: `${data.amount_transferred} ${data.currency} transférés au vendeur.`,
        });
      }

      refreshTransactions();
    } catch (error: any) {
      console.error('Error releasing funds:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la libération des fonds",
        variant: "destructive",
      });
    } finally {
      setValidatingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const handleInvoiceDownload = async (transaction: any) => {
    if (!user) return;

    try {
      toast({
        title: "Génération de la facture...",
        description: "Veuillez patienter",
      });

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile) {
        throw new Error('Impossible de récupérer le profil utilisateur');
      }

      const userEmail = user.email || '';
      
      let invoiceData: string;
      let filename: string;

      // Generate appropriate invoice based on user role
      if (transaction.user_role === 'seller') {
        invoiceData = await generateSellerInvoice(transaction, userProfile, userEmail);
        filename = `RIVVLOCK_Vendeur_${transaction.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      } else {
        invoiceData = await generateBuyerInvoice(transaction, userProfile, userEmail);
        filename = `RIVVLOCK_Acheteur_${transaction.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      }

      // Download the invoice
      downloadInvoice(invoiceData, filename);

      // Check if mobile for different success message
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        navigator.userAgent.toLowerCase()
      );
      
      toast({
        title: isMobile ? "Facture générée" : "Facture téléchargée",
        description: isMobile 
          ? "La facture s'ouvre dans un nouvel onglet. Utilisez 'Partager' pour sauvegarder."
          : "La facture a été générée et téléchargée avec succès",
      });

    } catch (error: any) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la génération de la facture",
        variant: "destructive",
      });
    }
  };

  const openDisputeModal = (transactionId: string, role: 'seller' | 'buyer') => {
    setDisputeTransactionId(transactionId);
    setDisputeRole(role);
    setDisputeModalOpen(true);
  };

  const handleDisputeCreated = () => {
    refreshTransactions();
    setDisputeModalOpen(false);
    setDisputeTransactionId(null);
    setDisputeRole(null);
  };

  const syncWithStripe = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stripe-payments');
      
      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Synchronisation terminée",
        description: `${data.synchronized} transaction(s) synchronisée(s) avec Stripe`,
      });

      // Refresh transactions to show updated data
      refreshTransactions();
    } catch (error) {
      toast({
        title: "Erreur de synchronisation",
        description: "Impossible de synchroniser avec Stripe. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute effective status for display
  const getComputedStatus = (transaction: any) => {
    // If payment_blocked_at exists, treat as 'paid' for display (blocked funds)
    if (transaction.payment_blocked_at) {
      return 'paid';
    }
    return transaction.status;
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const computedStatus = getComputedStatus(transaction);
    const matchesStatus = statusFilter === 'all' || computedStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: Clock,
        color: 'text-yellow-600'
      },
      validated: {
        badge: 'bg-green-100 text-green-800 border-green-200',
        icon: CheckCircle,
        color: 'text-green-600'
      },
      paid: {
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: CheckCircle,
        color: 'text-blue-600'
      },
      disputed: {
        badge: 'bg-red-100 text-red-800 border-red-200',
        icon: AlertTriangle,
        color: 'text-red-600'
      }
    };
    
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const getStatusCounts = () => {
    const countsWithComputedStatus = {
      all: transactions.length,
      pending: 0,
      paid: 0,
      validated: 0,
      disputed: 0,
    };

    transactions.forEach(t => {
      const computedStatus = getComputedStatus(t);
      countsWithComputedStatus[computedStatus as keyof typeof countsWithComputedStatus]++;
    });

    return countsWithComputedStatus;
  };

  const statusCounts = getStatusCounts();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {t('transactions.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez toutes vos transactions escrow
            </p>
          </div>
          <Button 
            className="gradient-primary text-white"
            onClick={() => navigate('/create-transaction')}
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('transactions.new')}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { key: 'all', label: 'Total', count: statusCounts.all, color: 'text-gray-600' },
            { key: 'pending', label: t('transactions.pending'), count: statusCounts.pending, color: 'text-yellow-600' },
            { key: 'paid', label: t('transactions.paid'), count: statusCounts.paid, color: 'text-blue-600' },
            { key: 'validated', label: 'Complétées', count: statusCounts.validated, color: 'text-green-600' },
            { key: 'disputed', label: t('transactions.disputed'), count: statusCounts.disputed, color: 'text-red-600' },
          ].map((stat) => (
            <Card 
              key={stat.key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === stat.key ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => setStatusFilter(stat.key)}
            >
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {stat.count}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher une transaction..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={syncWithStripe}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sync en cours...' : 'Sync Transaction'}
                </Button>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">{t('transactions.pending')}</SelectItem>
                    <SelectItem value="paid">{t('transactions.paid')}</SelectItem>
                    <SelectItem value="validated">Complétées</SelectItem>
                    <SelectItem value="disputed">{t('transactions.disputed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Chargement des transactions...</p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={() => refreshTransactions()}>Réessayer</Button>
              </CardContent>
            </Card>
          ) : (
            filteredTransactions.map((transaction) => {
              const computedStatus = getComputedStatus(transaction);
              const statusConfig = getStatusConfig(computedStatus);
              const StatusIcon = statusConfig.icon;
              
              return (
                <Card key={transaction.id} className="hover:shadow-md transition-all duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{transaction.title}</h3>
                               <Badge className={statusConfig.badge}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {t(`transactions.${computedStatus}`)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              ID: {transaction.id.substring(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground">
                              {formatAmount(transaction.price, transaction.currency)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {transaction.currency}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-muted-foreground">
                          {transaction.description}
                        </p>

                        {/* Details */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <strong>{transaction.user_role === 'seller' ? 'Acheteur:' : 'Vendeur:'}</strong> {getCounterpartyDisplayName(transaction)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {transaction.user_role === 'seller' ? 'Vendeur' : 'Acheteur'}
                            </Badge>
                          </div>
                          <div>
                            <strong>Service:</strong> {format(new Date(transaction.service_date), 'PPP', { locale: fr })}
                          </div>
                          <div>
                            <strong>Créé:</strong> {format(new Date(transaction.created_at), 'PPP', { locale: fr })}
                          </div>
                          {transaction.payment_deadline && (
                            <div>
                              <strong>Paiement avant:</strong> {format(new Date(transaction.payment_deadline), 'PPP', { locale: fr })}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              if (transaction.shared_link_token) {
                                navigate(`/join-transaction/${transaction.shared_link_token}`);
                              }
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir détails
                          </Button>
                          
                          {transaction.status === 'validated' ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleInvoiceDownload(transaction)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger la Facture
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => copyInvitationLink(transaction.shared_link_token)}
                              disabled={!transaction.shared_link_token}
                            >
                              <Link className="w-4 h-4 mr-2" />
                              Copier le lien
                            </Button>
                          )}

                           {/* Seller validation button */}
                          {computedStatus === 'paid' && 
                           transaction.user_role === 'seller' && 
                           !transaction.seller_validated && (
                            <>
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleSellerValidation(transaction.id)}
                                disabled={validatingTransactions.has(transaction.id)}
                              >
                                {validatingTransactions.has(transaction.id) ? (
                                  <Timer className="w-4 h-4 mr-2 animate-pulse" />
                                ) : (
                                  <CheckCheck className="w-4 h-4 mr-2" />
                                )}
                                Finaliser
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-orange-600 border-orange-600 hover:bg-orange-50"
                                onClick={() => openDisputeModal(transaction.id, 'seller')}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Ouvrir un Litige
                              </Button>
                            </>
                          )}

                          {/* Seller validated state */}
                          {computedStatus === 'paid' && 
                           transaction.user_role === 'seller' && 
                           transaction.seller_validated && 
                           !transaction.buyer_validated && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              disabled
                            >
                              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                              En attente acheteur
                            </Button>
                          )}

                           {/* Buyer fund release button */}
                          {computedStatus === 'paid' && 
                           transaction.user_role === 'buyer' && 
                           transaction.stripe_payment_intent_id && (
                            <>
                              <Button 
                                size="sm" 
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handleFundsRelease(transaction.id)}
                                disabled={validatingTransactions.has(transaction.id)}
                              >
                                {validatingTransactions.has(transaction.id) ? (
                                  <Timer className="w-4 h-4 mr-2 animate-pulse" />
                                ) : (
                                  <Banknote className="w-4 h-4 mr-2" />
                                )}
                                {transaction.seller_validated ? 'Libérer les Fonds' : 'Libérer les Fonds (En attente vendeur)'}
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                                onClick={() => openDisputeModal(transaction.id, 'buyer')}
                              >
                                <Flag className="w-4 h-4 mr-2" />
                                Signaler un Litige
                              </Button>
                            </>
                          )}

                          {transaction.status === 'pending' && (
                            <Button 
                              size="sm" 
                              className="gradient-success text-white"
                              onClick={() => {
                                if (transaction.shared_link_token) {
                                  navigate(`/payment-link/${transaction.shared_link_token}`);
                                }
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Accéder au paiement
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Empty State */}
        {!loading && !error && filteredTransactions.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  Aucune transaction trouvée
                </p>
                <p className="text-sm">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Essayez de modifier vos critères de recherche'
                    : 'Créez votre première transaction pour commencer'
                  }
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <Button 
                    className="mt-4 gradient-primary text-white"
                    onClick={() => navigate('/create-transaction')}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une transaction
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dispute Modal */}
      <DisputeModal
        isOpen={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        transactionId={disputeTransactionId}
        userRole={disputeRole}
        onDisputeCreated={handleDisputeCreated}
      />
    </Layout>
  );
};