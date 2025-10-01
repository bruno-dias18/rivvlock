import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CreditCard, ExternalLink, Copy, Clock, AlertCircle, Lock, CheckCircle2, Check, AlertTriangle, Download } from 'lucide-react';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { BankAccountRequiredDialog } from '@/components/BankAccountRequiredDialog';
import { CreateDisputeDialog } from '@/components/CreateDisputeDialog';
import { TransactionCard } from '@/components/TransactionCard';
import { DisputeCard } from '@/components/DisputeCard';
import { useDisputes } from '@/hooks/useDisputes';
import { useNewItemsNotifications } from '@/hooks/useNewItemsNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransactions, useSyncStripePayments } from '@/hooks/useTransactions';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useProfile } from '@/hooks/useProfile';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { useIsMobile } from '@/lib/mobileUtils';
import { CompleteTransactionButtonWithStatus } from '@/components/CompleteTransactionButtonWithStatus';
import { LocalErrorBoundary } from '@/components/LocalErrorBoundary';
import { shareOrCopy } from '@/lib/copyUtils';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);
  const [disputeDialog, setDisputeDialog] = useState<{ open: boolean; transaction: any }>({ open: false, transaction: null });
  
  const { data: transactions = [], isLoading, error: queryError, refetch } = useTransactions();
  const { data: disputes = [], refetch: refetchDisputes } = useDisputes();
  const { data: stripeAccount } = useStripeAccount();
  const { syncPayments } = useSyncStripePayments();
  const { newCounts, markAsSeen, refetch: refetchNotifications } = useNewItemsNotifications();
  
  const activeTab = searchParams.get('tab') || 'pending';

  // Check for success message after joining a transaction
  useEffect(() => {
    if (searchParams.get('joined') === 'success') {
      toast.success(t('transactions.joinedSuccess'), {
        description: t('transactions.joinedDescription'),
      });
      
      // Clean up URL
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('joined');
      setSearchParams(newSearchParams, { replace: true });
      
      // Refresh transactions
      refetch();
    }
  }, [searchParams, refetch, setSearchParams]);

  // Auto-sync disabled - transactions stay pending until user explicitly pays
  // Manual sync is still available via the sync button in DashboardLayout

  // Mark as seen when tab changes
  useEffect(() => {
    const tabToCategoryMap: Record<string, 'pending' | 'blocked' | 'disputed' | 'completed'> = {
      pending: 'pending',
      blocked: 'blocked',
      disputed: 'disputed',
      completed: 'completed',
    };
    
    const category = tabToCategoryMap[activeTab];
    if (category) {
      markAsSeen(category);
      refetchNotifications();
    }
  }, [activeTab, markAsSeen, refetchNotifications]);

  const handleSyncPayments = async () => {
    toast.promise(
      (async () => {
        await syncPayments();
        await refetch();
      })(),
      {
        loading: t('transactions.syncInProgress'),
        success: t('transactions.syncCompleted'),
        error: t('transactions.syncError'),
      }
    );
  };

  // Filter transactions by status
  const pendingTransactions = transactions.filter(t => t.status === 'pending');
  const blockedTransactions = transactions.filter(t => t.status === 'paid');
  const completedTransactions = transactions.filter(t => t.status === 'validated');
  const disputedTransactions = transactions.filter(t => t.status === 'disputed');

  const handleCopyLink = async (text: string) => {
    try {
      const result = await shareOrCopy(text, 'RivvLock - Paiement sécurisé', { fallbackToPrompt: true });
      
      if (result.success) {
        if (result.method === 'share') {
          toast.success('Lien partagé avec succès !');
        } else if (result.method === 'prompt') {
          toast.success(t('transactions.linkReady'));
        } else {
          toast.success(t('transactions.linkCopied'));
        }
      } else {
        toast.error(t('transactions.copyError'));
      }
    } catch (error) {
      console.error('Failed to copy/share link:', error);
      toast.error(t('transactions.copyError'));
    }
  };

  const handlePayment = async (transaction: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
        body: { transactionId: transaction.id }
      });

      if (error) throw error;

      const url = data?.url || data?.sessionUrl;
      if (!url) throw new Error('URL de session Stripe introuvable');

      if (isMobile) {
        // iOS/Safari: ensure navigation is not blocked even after async
        setTimeout(() => {
          window.location.assign(url);
        }, 0);
      } else {
        const opened = window.open(url, '_blank');
        if (!opened) {
          // Fallback if popup blocked
          window.location.assign(url);
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error(t('transactions.paymentError'), {
        description: t('transactions.paymentErrorDescription'),
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

      toast.success(t('transactions.fundsReleased'));
      refetch();
    } catch (error) {
      console.error('Error releasing funds:', error);
      toast.error(t('transactions.releaseError'));
    }
  };

  const getUserRole = (transaction: any) => {
    if (transaction.user_id === user?.id) return 'seller';
    if (transaction.buyer_id === user?.id) return 'buyer';
    return null;
  };

  const handleDeleteExpiredTransaction = async (transaction: any) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction expirée ? Cette action est irréversible.')) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('delete-expired-transaction', {
        body: { transactionId: transaction.id }
      });

      if (error) {
        console.error('Error deleting transaction:', error);
        
        // If deletion fails, try to sync expired statuses and retry
        if (error.message?.includes('Only expired transactions')) {
          toast.loading('Synchronisation en cours...');
          await supabase.functions.invoke('process-expired-payment-deadlines', { body: {} });
          await refetch();
          toast.error('Veuillez réessayer la suppression après synchronisation');
        } else {
          toast.error('Erreur lors de la suppression de la transaction');
        }
        return;
      }

      toast.success('Transaction supprimée avec succès');
      refetch(); // Refresh the transactions list
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Erreur lors de la suppression de la transaction');
    }
  };

  const handleRenewExpiredTransaction = async (transaction: any, newServiceDate?: Date, message?: string) => {
    try {
      toast.loading('Relance de la transaction en cours...');

      const { data, error } = await supabase.functions.invoke('renew-expired-transaction', {
        body: { 
          transactionId: transaction.id,
          newServiceDate: newServiceDate?.toISOString(),
          message
        }
      });

      if (error) {
        console.error('Error renewing transaction:', error);
        toast.dismiss();
        
        // Handle specific error messages
        if (error.message?.includes('Maximum number of renewals')) {
          toast.error('Limite de relances atteinte', {
            description: 'Cette transaction a déjà été relancée le nombre maximum de fois'
          });
        } else if (error.message?.includes('Only expired transactions')) {
          toast.error('Cette transaction ne peut pas être relancée');
        } else {
          toast.error('Erreur lors de la relance de la transaction');
        }
        return;
      }

      toast.dismiss();
      toast.success('Transaction relancée avec succès !', {
        description: 'Le client dispose maintenant de 48h pour effectuer le paiement'
      });
      
      refetch(); // Refresh the transactions list
    } catch (error) {
      console.error('Error renewing transaction:', error);
      toast.dismiss();
      toast.error('Erreur lors de la relance de la transaction');
    }
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
        ? `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim() || 'Client'
        : transaction.buyer_display_name || 'Client anonyme';

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

      generateInvoicePDF({
        ...invoiceData,
        language: i18n.language,
        t
      });
    } catch (error) {
      console.error('Erreur lors de la génération de la facture:', error);
      toast.error(t('transactions.invoiceError'));
    }
  };



  return (
    <DashboardLayout onSyncPayments={handleSyncPayments}>
      <div className="space-y-6">
      <div className={`${isMobile ? 'space-y-4' : 'flex justify-between items-center'}`}>
        <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>{t('transactions.title')}</h1>
        <div className={`flex gap-2 ${isMobile ? 'flex-col sm:flex-row' : ''}`}>
          <Button 
            onClick={() => {
              // Check if Stripe account is properly configured
              const isStripeReady = stripeAccount?.has_account && 
                                   stripeAccount?.payouts_enabled && 
                                   stripeAccount?.charges_enabled && 
                                   stripeAccount?.details_submitted;
              
              if (!isStripeReady) {
                setIsBankAccountDialogOpen(true);
              } else {
                setIsNewTransactionOpen(true);
              }
            }}
            size={isMobile ? "default" : "default"}
            className={isMobile ? "justify-center" : ""}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? t('transactions.new') : t('transactions.newTransaction')}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })}>
        <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} ${isMobile ? 'h-auto' : ''}`}>
          <TabsTrigger value="pending" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''}`}>
            <Clock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `${t('transactions.waiting')} (${pendingTransactions.length})` : `${t('transactions.pending')} (${pendingTransactions.length})`}
            </span>
            {newCounts.pending > 0 && (
              <Badge className="bg-blue-500 text-white hover:bg-blue-600 ml-1">
                {newCounts.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''}`}>
            <Lock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `${t('transactions.blockedShort')} (${blockedTransactions.length})` : `${t('transactions.blocked')} (${blockedTransactions.length})`}
            </span>
            {newCounts.blocked > 0 && (
              <Badge className="bg-orange-500 text-white hover:bg-orange-600 ml-1">
                {newCounts.blocked}
              </Badge>
            )}
          </TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('transactions.completed')} ({completedTransactions.length})
                {newCounts.completed > 0 && (
                  <Badge className="bg-green-500 text-white hover:bg-green-600 ml-1">
                    {newCounts.completed}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {t('transactions.disputed')} ({disputedTransactions.length})
                {newCounts.disputed > 0 && (
                  <Badge className="bg-red-500 text-white hover:bg-red-600 ml-1">
                    {newCounts.disputed}
                  </Badge>
                )}
              </TabsTrigger>
            </>
          )}
          {isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2 flex-col py-3">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">{t('transactions.completed')} ({completedTransactions.length})</span>
                {newCounts.completed > 0 && (
                  <Badge className="bg-green-500 text-white hover:bg-green-600 ml-1">
                    {newCounts.completed}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2 flex-col py-3">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">{t('transactions.disputed')} ({disputedTransactions.length})</span>
                {newCounts.disputed > 0 && (
                  <Badge className="bg-red-500 text-white hover:bg-red-600 ml-1">
                    {newCounts.disputed}
                  </Badge>
                )}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>{t('transactions.pendingTransactions')}</CardTitle>
              <CardDescription>
                {t('transactions.pendingDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="mt-2 text-sm text-muted-foreground">{t('transactions.loading')}</p>
                </div>
              )}

              {queryError && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('transactions.loadingError')}</p>
                </div>
              )}

              {!isLoading && !queryError && pendingTransactions.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('transactions.noPending')}
                  </p>
                </div>
              )}

              {!isLoading && !queryError && pendingTransactions.length > 0 && (
                <LocalErrorBoundary onRetry={refetch}>
                  <div className="space-y-4">
                    {pendingTransactions.map(transaction => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        user={user}
                        showActions={true}
                        onCopyLink={handleCopyLink}
                        onPayment={handlePayment}
                        onRefetch={refetch}
                        onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                        onDownloadInvoice={handleDownloadInvoice}
                        onDeleteExpired={handleDeleteExpiredTransaction}
                        onRenewExpired={handleRenewExpiredTransaction}
                        CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                      />
                    ))}
                  </div>
                </LocalErrorBoundary>
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
                <LocalErrorBoundary onRetry={refetch}>
                  <div className="space-y-4">
                    {blockedTransactions.map(transaction => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        user={user}
                        showActions={true}
                        onCopyLink={handleCopyLink}
                        onPayment={handlePayment}
                        onRefetch={refetch}
                        onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                        onDownloadInvoice={handleDownloadInvoice}
                        onDeleteExpired={handleDeleteExpiredTransaction}
                        onRenewExpired={handleRenewExpiredTransaction}
                        CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                      />
                    ))}
                  </div>
                </LocalErrorBoundary>
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
                <LocalErrorBoundary onRetry={refetch}>
                  <div className="space-y-4">
                    {completedTransactions.map(transaction => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        user={user}
                        showActions={true}
                        onCopyLink={handleCopyLink}
                        onPayment={handlePayment}
                        onRefetch={refetch}
                        onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                        onDownloadInvoice={handleDownloadInvoice}
                        onDeleteExpired={handleDeleteExpiredTransaction}
                        onRenewExpired={handleRenewExpiredTransaction}
                        CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                      />
                    ))}
                  </div>
                </LocalErrorBoundary>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputed">
          <Card>
            <CardHeader>
              <CardTitle>{t('transactions.disputed')}</CardTitle>
              <CardDescription>
                {t('transactions.disputedDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!isLoading && !queryError && disputes.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('transactions.noDisputed')}
                  </p>
                </div>
              )}

              {!isLoading && !queryError && disputes.length > 0 && (
                <LocalErrorBoundary onRetry={() => { refetch(); refetchDisputes(); }}>
                  <div className="space-y-4">
                    {disputes.map(dispute => (
                      <DisputeCard
                        key={dispute.id}
                        dispute={dispute}
                        onRefetch={() => {
                          refetch();
                          refetchDisputes();
                        }}
                      />
                    ))}
                  </div>
                </LocalErrorBoundary>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BankAccountRequiredDialog
        open={isBankAccountDialogOpen}
        onOpenChange={setIsBankAccountDialogOpen}
        onSetupComplete={() => setIsNewTransactionOpen(true)}
      />

      <NewTransactionDialog 
        open={isNewTransactionOpen}
        onOpenChange={setIsNewTransactionOpen}
      />

      <CreateDisputeDialog
        open={disputeDialog.open}
        onOpenChange={(open) => setDisputeDialog({ open, transaction: disputeDialog.transaction })}
        transaction={disputeDialog.transaction}
        onDisputeCreated={() => refetch()}
      />
      </div>
    </DashboardLayout>
  );
}