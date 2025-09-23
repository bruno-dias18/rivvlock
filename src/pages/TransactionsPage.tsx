import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CreditCard, ExternalLink, Copy, Clock, AlertCircle, Lock, CheckCircle2, RefreshCw, Check, MessageSquare, AlertTriangle, Download } from 'lucide-react';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { ContactSellerDialog } from '@/components/ContactSellerDialog';
import { CreateDisputeDialog } from '@/components/CreateDisputeDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransactions, useSyncStripePayments } from '@/hooks/useTransactions';
import { useProfile } from '@/hooks/useProfile';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { useIsMobile } from '@/lib/mobileUtils';
import CompleteTransactionButton from '@/components/CompleteTransactionButton';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useSellerStripeStatus } from '@/hooks/useSellerStripeStatus';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [contactDialog, setContactDialog] = useState<{ open: boolean; transaction: any }>({ open: false, transaction: null });
  const [disputeDialog, setDisputeDialog] = useState<{ open: boolean; transaction: any }>({ open: false, transaction: null });
  
  const { data: transactions = [], isLoading, error: queryError, refetch } = useTransactions();
  const { syncPayments } = useSyncStripePayments();
  
  const activeTab = searchParams.get('tab') || 'pending';

  // Check for success message after joining a transaction
  useEffect(() => {
    if (searchParams.get('joined') === 'success') {
      toast.success("Transaction rejointe avec succès", {
        description: "Vous pouvez maintenant effectuer le paiement pour bloquer les fonds.",
      });
      
      // Clean up URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('joined');
      setSearchParams(newSearchParams, { replace: true });
      
      // Refresh transactions
      refetch();
    }
  }, [searchParams, refetch, setSearchParams]);

  const handleSyncPayments = async () => {
    try {
      toast.loading("Synchronisation en cours...", {
        description: "Vérification des paiements Stripe",
      });
      
      await syncPayments();
      await refetch();
      
      toast.success("Synchronisation terminée", {
        description: "Les données ont été mises à jour",
      });
    } catch (error) {
      console.error('Sync error:', error);
      toast.error("Erreur de synchronisation", {
        description: "Impossible de synchroniser les paiements",
      });
    }
  };

  // Filter transactions by status
  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const blockedTransactions = transactions.filter(t => t.status === 'paid');
  const completedTransactions = transactions.filter(t => t.status === 'validated');
  const disputedTransactions = transactions.filter(t => t.status === 'disputed');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Lien copié dans le presse-papier !');
  };

  const handlePayment = async (transaction: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: { transactionId: transaction.id }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error("Erreur de paiement", {
        description: "Impossible de créer la session de paiement. Veuillez réessayer.",
      });
    }
  };

  const handleReleaseFunds = async (transaction: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('release-funds', {
        body: { transactionId: transaction.id },
      });

      if (error) {
        throw error;
      }

      toast.success('Fonds libérés avec succès !');
      refetch();
    } catch (error) {
      console.error('Error releasing funds:', error);
      toast.error('Erreur lors de la libération des fonds');
    }
  };

  const getUserRole = (transaction: any) => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  };

  const handleDownloadInvoice = async (transaction: any) => {
    try {
      // Récupérer les profils vendeur et acheteur
      const [sellerProfileResult, buyerProfileResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', transaction.user_id)
          .maybeSingle(),
        transaction.buyer_id ? supabase
          .from('profiles')
          .select('*')
          .eq('user_id', transaction.buyer_id)
          .maybeSingle() : Promise.resolve({ data: null, error: null })
      ]);

      const sellerProfile = sellerProfileResult.data;
      const buyerProfile = buyerProfileResult.data;
      
      // Pour maintenant, utiliser l'approche actuelle mais améliorer la logique
      const currentUser = user;
      let sellerEmail = undefined;
      let buyerEmail = undefined;
      
      // Si le user connecté est le vendeur, on a son email
      if (currentUser?.id === transaction.user_id) {
        sellerEmail = currentUser.email;
      }
      // Si le user connecté est l'acheteur, on a son email  
      if (currentUser?.id === transaction.buyer_id) {
        buyerEmail = currentUser.email;
      }
      
      // Appeler l'edge function pour récupérer les emails manquants
      try {
        const { data: emailData } = await supabase.functions.invoke('get-user-emails', {
          body: { 
            sellerUserId: transaction.user_id,
            buyerUserId: transaction.buyer_id 
          }
        });
        
        if (emailData) {
          sellerEmail = sellerEmail || emailData.sellerEmail;
          buyerEmail = buyerEmail || emailData.buyerEmail;
        }
      } catch (error) {
        console.warn('Impossible de récupérer les emails via edge function:', error);
      }

      const userRole = getUserRole(transaction);
      const sellerName = sellerProfile 
        ? `${sellerProfile.first_name || ''} ${sellerProfile.last_name || ''}`.trim() || 'Vendeur'
        : transaction.seller_display_name || 'Vendeur';
      
      const buyerName = buyerProfile
        ? `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Acheteur'
        : transaction.buyer_display_name || 'Acheteur anonyme';

      const invoiceData = {
        transactionId: transaction.id,
        title: transaction.title,
        description: transaction.description,
        amount: parseFloat(transaction.price),
        currency: transaction.currency,
        sellerName,
        buyerName,
        serviceDate: transaction.service_date,
        validatedDate: transaction.updated_at,
        sellerProfile,
        buyerProfile,
        sellerEmail,
        buyerEmail,
      };

      generateInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Erreur lors de la génération de la facture:', error);
      toast.error('Erreur lors de la génération de la facture');
    }
  };

  const renderTransactionCard = (transaction: any, showActions = true) => {
    const userRole = getUserRole(transaction);
    const displayName = userRole === 'seller' 
      ? transaction.buyer_display_name || 'Acheteur anonyme'
      : transaction.seller_display_name || 'Vendeur';

    return (
      <Card key={transaction.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
            <div className="flex-1">
              <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>{transaction.title}</CardTitle>
              <CardDescription className="mt-1">
                {transaction.description}
              </CardDescription>
            </div>
            <div className={`${isMobile ? 'flex justify-between items-center' : 'text-right ml-4'}`}>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
                {transaction.price} {transaction.currency?.toUpperCase()}
              </div>
              <Badge variant="outline" className="mt-1">
                {userRole === 'seller' ? 'Vendeur' : 'Acheteur'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            <div>Partenaire: {displayName}</div>
            <div>Créée le: {new Date(transaction.created_at).toLocaleDateString('fr-FR')}</div>
            {transaction.service_date && (
              <div>Service prévu: {new Date(transaction.service_date).toLocaleDateString('fr-FR')}</div>
            )}
          </div>
          
          {showActions && (
            <div className={`flex gap-2 pt-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
              {userRole === 'seller' && transaction.status === 'pending' && (
                <Button
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={() => copyToClipboard(`${window.location.origin}/join/${transaction.shared_link_token}`)}
                  className={isMobile ? "justify-center" : ""}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {isMobile ? 'Copier' : 'Copier le lien'}
                </Button>
              )}
              
              {userRole === 'buyer' && transaction.status === 'pending' && (
                <Button
                  size={isMobile ? "default" : "sm"}
                  onClick={() => handlePayment(transaction)}
                  className={isMobile ? "justify-center" : ""}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {isMobile ? 'Bloquer' : 'Bloquer l\'argent'}
                </Button>
              )}
              
              {transaction.status === 'paid' && userRole === 'seller' && (
                <Button 
                  variant="outline" 
                  size={isMobile ? "default" : "sm"}
                  className={isMobile ? "justify-center" : ""}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Valider
                </Button>
              )}
              
              {transaction.status === 'paid' && userRole === 'buyer' && (
                <CompleteTransactionButtonWithStatus
                  transaction={transaction}
                  onTransferComplete={() => refetch()}
                />
              )}

              {transaction.status === 'validated' && (
                <Button 
                  variant="outline" 
                  size={isMobile ? "default" : "sm"}
                  onClick={() => handleDownloadInvoice(transaction)}
                  className={isMobile ? "justify-center" : ""}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isMobile ? 'Facture' : 'Télécharger la facture'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Component wrapper to handle seller Stripe status
  const CompleteTransactionButtonWithStatus = ({ 
    transaction, 
    onTransferComplete 
  }: { 
    transaction: any; 
    onTransferComplete: () => void; 
  }) => {
    const { data: sellerStatus } = useSellerStripeStatus(transaction.user_id);
    
    return (
      <CompleteTransactionButton
        transactionId={transaction.id}
        transactionStatus={transaction.status}
        isUserBuyer={true}
        sellerHasStripeAccount={sellerStatus?.hasActiveAccount || false}
        onTransferComplete={onTransferComplete}
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className={`${isMobile ? 'space-y-4' : 'flex justify-between items-center'}`}>
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>Transactions</h1>
        <div className={`flex gap-2 ${isMobile ? 'flex-col sm:flex-row' : ''}`}>
          <Button 
            variant="outline" 
            onClick={handleSyncPayments}
            size={isMobile ? "default" : "default"}
            className={isMobile ? "justify-center" : ""}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {isMobile ? 'Sync' : 'Actualiser'}
          </Button>
          <Button 
            onClick={() => setIsNewTransactionOpen(true)}
            size={isMobile ? "default" : "default"}
            className={isMobile ? "justify-center" : ""}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? 'Nouvelle' : 'Nouvelle transaction'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} ${isMobile ? 'h-auto' : ''}`}>
          <TabsTrigger value="pending" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''}`}>
            <Clock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `Attente (${pendingTransactions.length})` : `En attente (${pendingTransactions.length})`}
            </span>
          </TabsTrigger>
          <TabsTrigger value="blocked" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''}`}>
            <Lock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `Bloqués (${blockedTransactions.length})` : `Fonds bloqués (${blockedTransactions.length})`}
            </span>
          </TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Complétées ({completedTransactions.length})
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Litiges ({disputedTransactions.length})
              </TabsTrigger>
            </>
          )}
          {isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2 flex-col py-3">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">Complétées ({completedTransactions.length})</span>
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2 flex-col py-3">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Litiges ({disputedTransactions.length})</span>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Transactions en attente</CardTitle>
              <CardDescription>
                Transactions nécessitant un paiement ou en attente d'un acheteur
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
                </div>
              )}

              {queryError && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Erreur de chargement</p>
                </div>
              )}

              {!isLoading && !queryError && pendingTransactions.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucune transaction en attente
                  </p>
                </div>
              )}

              {!isLoading && !queryError && pendingTransactions.length > 0 && (
                <div className="space-y-4">
                  {pendingTransactions.map(transaction => renderTransactionCard(transaction))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle>Fonds bloqués</CardTitle>
              <CardDescription>
                Transactions avec paiement effectué, en attente de validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isLoading && !queryError && blockedTransactions.length === 0 && (
                <div className="text-center py-8">
                  <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucun fonds bloqué
                  </p>
                </div>
              )}

              {!isLoading && !queryError && blockedTransactions.length > 0 && (
                <div className="space-y-4">
                  {blockedTransactions.map(transaction => renderTransactionCard(transaction))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader>
              <CardTitle>Transactions complétées</CardTitle>
              <CardDescription>
                Transactions validées et terminées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isLoading && !queryError && completedTransactions.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucune transaction complétée
                  </p>
                </div>
              )}

              {!isLoading && !queryError && completedTransactions.length > 0 && (
                <div className="space-y-4">
                  {completedTransactions.map(transaction => renderTransactionCard(transaction, true))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputed">
          <Card>
            <CardHeader>
              <CardTitle>Transactions en litige</CardTitle>
              <CardDescription>
                Transactions faisant l'objet d'un litige ouvert
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isLoading && !queryError && disputedTransactions.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aucune transaction en litige
                  </p>
                </div>
              )}

              {!isLoading && !queryError && disputedTransactions.length > 0 && (
                <div className="space-y-4">
                  {disputedTransactions.map(transaction => renderTransactionCard(transaction, false))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NewTransactionDialog 
        open={isNewTransactionOpen}
        onOpenChange={setIsNewTransactionOpen}
      />

      <ContactSellerDialog
        open={contactDialog.open}
        onOpenChange={(open) => setContactDialog({ open, transaction: contactDialog.transaction })}
        transaction={contactDialog.transaction}
      />

      <CreateDisputeDialog
        open={disputeDialog.open}
        onOpenChange={(open) => setDisputeDialog({ open, transaction: disputeDialog.transaction })}
        transaction={disputeDialog.transaction}
        onDisputeCreated={() => refetch()}
      />
    </div>
  );
}