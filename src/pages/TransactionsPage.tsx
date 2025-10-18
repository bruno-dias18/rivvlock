import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, CreditCard, ExternalLink, Copy, Clock, AlertCircle, Lock, CheckCircle2, Check, AlertTriangle, Download, Calendar, Bell, MessageSquare } from 'lucide-react';
import { PaymentCountdown } from '@/components/PaymentCountdown';
import { ValidationCountdown } from '@/components/ValidationCountdown';
import { ValidationActionButtons } from '@/components/ValidationActionButtons';
import { NewTransactionDialog } from '@/components/NewTransactionDialog';
import { BankAccountRequiredDialog } from '@/components/BankAccountRequiredDialog';
import { CreateDisputeDialog } from '@/components/CreateDisputeDialog';
import { TransactionCard } from '@/components/TransactionCard';
import { VirtualTransactionList } from '@/components/VirtualTransactionList';
import { DisputeCard } from '@/components/DisputeCard';
import { SkeletonLayouts } from '@/components/ui/skeleton';
import { useDisputes } from '@/hooks/useDisputes';
import { useNewItemsNotifications } from '@/hooks/useNewItemsNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransactions, useSyncStripePayments } from '@/hooks/useTransactions';
import { usePaginatedTransactions } from '@/hooks/usePaginatedTransactions';
import { PaginationControls } from '@/components/transactions/PaginationControls';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { useProfile } from '@/hooks/useProfile';
import { useTransactionsWithNewActivity } from '@/hooks/useTransactionsWithNewActivity';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { useUnreadTransactionTabCounts } from '@/hooks/useUnreadTransactionTabCounts';
import { useUnreadAdminMessages } from '@/hooks/useUnreadAdminMessages';
import { useIsMobile } from '@/lib/mobileUtils';
import { CompleteTransactionButtonWithStatus } from '@/components/CompleteTransactionButtonWithStatus';
import { LocalErrorBoundary } from '@/components/LocalErrorBoundary';
import { shareOrCopy } from '@/lib/copyUtils';
import { DashboardLayoutWithSidebar } from '@/components/layouts/DashboardLayoutWithSidebar';
import { SortButtons } from '@/components/SortButtons';
import { logger } from '@/lib/logger';
import { getPublicBaseUrl } from '@/lib/appUrl';
import { useUnreadDisputesGlobal } from '@/hooks/useUnreadDisputesGlobal';
import type { Transaction } from '@/types';

export default function TransactionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNewTransactionOpen, setIsNewTransactionOpen] = useState(false);
  const [isBankAccountDialogOpen, setIsBankAccountDialogOpen] = useState(false);
  const [disputeDialog, setDisputeDialog] = useState<{ open: boolean; transaction: Transaction | null }>({ open: false, transaction: null });
  
  const scrollToTransactionId = searchParams.get('scrollTo');
  
  // Sort states with localStorage persistence
  const [sortBy, setSortBy] = useState<'created_at' | 'service_date' | 'funds_released_at'>(() => {
    const saved = localStorage.getItem('rivvlock-transactions-sort');
    if (saved) {
      try {
        const { sortBy } = JSON.parse(saved);
        return sortBy || 'service_date';
      } catch {
        return 'service_date';
      }
    }
    return 'service_date';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('rivvlock-transactions-sort');
    if (saved) {
      try {
        const { sortOrder } = JSON.parse(saved);
        return sortOrder === 'asc' ? 'asc' : 'desc';
      } catch {
        return 'desc';
      }
    }
    return 'desc';
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Feature flag: enable pagination (set to true to activate)
  const usePagination = true;

  // Map sortBy for pagination (only supports created_at, updated_at, price)
  const paginatedSortBy = (['created_at', 'updated_at', 'price'].includes(sortBy) 
    ? sortBy 
    : 'created_at') as 'created_at' | 'updated_at' | 'price';

  // Use paginated transactions hook if enabled
  const { 
    data: paginatedData,
    isLoading: paginatedLoading,
    refetch: refetchPaginated
  } = usePaginatedTransactions({
    page: currentPage,
    pageSize,
    sortBy: paginatedSortBy,
    sortOrder: sortOrder as 'asc' | 'desc'
  });

  // Use standard hook as fallback
  const { 
    data: allTransactions = [], 
    isLoading: allLoading,
    error: queryError,
    refetch: refetchAll 
  } = useTransactions();

  // Select data source based on feature flag
  const transactions = usePagination ? (paginatedData?.transactions || []) : allTransactions;
  const isLoading = usePagination ? paginatedLoading : allLoading;
  const refetch = usePagination ? refetchPaginated : refetchAll;
  
  const { data: disputes = [], refetch: refetchDisputes } = useDisputes();
  const { data: stripeAccount } = useStripeAccount();
  const { syncPayments } = useSyncStripePayments();
  const { newCounts, markAsSeen, refetch: refetchNotifications } = useNewItemsNotifications();
  const { unreadCount: unreadAdminMessages } = useUnreadAdminMessages();
  const { unreadCount: unreadDisputeMsgs, markAllAsSeen: markDisputesSeen } = useUnreadDisputesGlobal();
  
  const activeTab = searchParams.get('tab') || 'pending';
  
  // Map active tab to category for new activity notifications
  const tabToCategoryMap: Record<string, 'pending' | 'blocked' | 'disputed' | 'completed'> = {
    pending: 'pending',
    blocked: 'blocked',
    disputed: 'disputed',
    completed: 'completed',
  };
  
  const currentCategory = tabToCategoryMap[activeTab] || 'pending';
  const { data: transactionsWithNewActivity } = useTransactionsWithNewActivity(currentCategory);

  // Update sort and save to localStorage
  const updateSort = (newSortBy: 'created_at' | 'service_date' | 'funds_released_at') => {
    let newSortOrder: 'asc' | 'desc';
    
    if (sortBy === newSortBy) {
      // Même bouton cliqué → inverser l'ordre
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // Nouveau bouton → ordre par défaut selon le type
      if (newSortBy === 'created_at' || newSortBy === 'funds_released_at') {
        newSortOrder = 'desc'; // Création / Complétée : récentes d'abord
      } else {
        newSortOrder = 'asc';  // Service : anciennes d'abord
      }
    }
    
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    localStorage.setItem('rivvlock-transactions-sort', JSON.stringify({
      sortBy: newSortBy,
      sortOrder: newSortOrder
    }));
  };

  // Sort transactions function
  const sortTransactions = (transactions: any[]): any[] => {
    return [...transactions].sort((a, b) => {
      let valueA: string;
      let valueB: string;
      
      if (sortBy === 'service_date') {
        valueA = a.service_date;
        valueB = b.service_date;
      } else if (sortBy === 'funds_released_at') {
        valueA = a.funds_released_at;
        valueB = b.funds_released_at;
      } else {
        valueA = a.created_at;
        valueB = b.created_at;
      }
      
      // Handle null values (put them at the end)
      if (sortBy === 'service_date' || sortBy === 'funds_released_at') {
        if (!valueA && !valueB) return 0;
        if (!valueA) return 1;
        if (!valueB) return -1;
      }
      
      const comparison = new Date(valueA).getTime() - new Date(valueB).getTime();
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  };

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
    const category = tabToCategoryMap[activeTab];
    if (category) {
      markAsSeen(category);
      refetchNotifications();
    }
    if (activeTab === 'disputed') {
      // Clear global dispute message badge when user visits Litiges
      markDisputesSeen();
    }
  }, [activeTab, markAsSeen, refetchNotifications, markDisputesSeen]);

  // Scroll to transaction when scrollTo parameter is present
  useEffect(() => {
    if (scrollToTransactionId) {
      setTimeout(() => {
        const element = document.getElementById(`transaction-${scrollToTransactionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight effect
          element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
        // Clean up URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('scrollTo');
        setSearchParams(newParams, { replace: true });
      }, 300);
    }
  }, [scrollToTransactionId, activeTab, searchParams, setSearchParams]);

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

  // Filter and sort transactions by status
  const pendingTransactions = sortTransactions(transactions.filter(t => t.status === 'pending'));
  const blockedTransactions = sortTransactions(transactions.filter(t => t.status === 'paid'));
  const completedTransactions = sortTransactions(transactions.filter(t => t.status === 'validated' && t.refund_status !== 'full'));
  const disputedTransactions = sortTransactions(transactions.filter(t => t.status === 'disputed'));
  
  // Get unread messages counts per tab with unified system
  const tabCounts = useUnreadTransactionTabCounts(transactions);

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
      logger.error('Failed to copy/share link:', error);
      toast.error(t('transactions.copyError'));
    }
  };

  const handlePayment = async (transaction: any) => {
    try {
      const base = getPublicBaseUrl();
      const token = transaction.shared_link_token;
      const targetUrl = token
        ? `${base}/payment-link/${token}?payment=cancelled`
        : `${base}/payment-link/${transaction.id}?txId=${transaction.id}&payment=cancelled`;

      // Open the RivvLock payment link (method selection) instead of Stripe
      window.location.assign(targetUrl);
    } catch (error) {
      logger.error('Payment redirect error:', error);
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
      logger.error('Error releasing funds:', error);
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
        logger.error('Error deleting transaction:', error);
        
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
      logger.error('Error deleting transaction:', error);
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
         logger.error('Error renewing transaction:', error);
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
      logger.error('Error renewing transaction:', error);
      toast.dismiss();
      toast.error('Erreur lors de la relance de la transaction');
    }
  };

  const handleDownloadInvoice = async (transaction: any) => {
    try {
      // Use secure edge function to get invoice data with proper authorization
      const { data: invoiceDataResponse, error: invoiceDataError } = await supabase.functions.invoke('get-invoice-data', {
        body: { transactionId: transaction.id }
      });

      if (invoiceDataError) {
        logger.error('Error fetching invoice data:', invoiceDataError);
        toast.error(t('transactions.invoiceError'));
        return;
      }

      const { sellerProfile, buyerProfile } = invoiceDataResponse;
      
      logger.log('Invoice data received:', { sellerProfile, buyerProfile });

      // Fallback: if sellerProfile is missing, call secure RPC directly from client
      let sellerProfileFinal = sellerProfile;
      try {
        if (!sellerProfileFinal) {
          const { data: fallbackSeller } = await supabase.rpc('get_seller_invoice_data', {
            p_seller_id: transaction.user_id,
            p_requesting_user_id: user?.id,
          });
          sellerProfileFinal = Array.isArray(fallbackSeller) && fallbackSeller.length > 0 ? fallbackSeller[0] : null;
          logger.log('Fallback seller profile via RPC:', sellerProfileFinal);
        }
        // Fallback 2: if current user is the seller, use their own profile from hook
        if (!sellerProfileFinal && user?.id === transaction.user_id && profile) {
          sellerProfileFinal = profile as any;
          logger.log('Using local profile as seller profile fallback');
        }
      } catch (e) {
        logger.warn('Fallback seller RPC failed', e);
      }

      // Fallback: if buyerProfile is missing, call secure RPC directly from client
      let buyerProfileFinal = buyerProfile;
      try {
        if (!buyerProfileFinal && transaction.buyer_id) {
          const { data: fallbackBuyer } = await supabase.rpc('get_buyer_invoice_data', {
            p_buyer_id: transaction.buyer_id,
            p_requesting_user_id: user?.id,
          });
          buyerProfileFinal = Array.isArray(fallbackBuyer) && fallbackBuyer.length > 0 ? fallbackBuyer[0] : null;
          logger.log('Fallback buyer profile via RPC:', buyerProfileFinal);
        }
        // Fallback 2: if current user is the buyer, use their own profile from hook
        if (!buyerProfileFinal && user?.id === transaction.buyer_id && profile) {
          buyerProfileFinal = profile as any;
          logger.log('Using local profile as buyer profile fallback');
        }
      } catch (e) {
        logger.warn('Fallback buyer RPC failed', e);
      }
      
      // Récupération des emails de manière sécurisée
      const currentUser = user;
      let sellerEmail = undefined;
      let buyerEmail = undefined;
      
      // Toujours appeler l'edge function pour récupérer les emails via la méthode sécurisée
      try {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('get-user-emails', {
          body: { 
            sellerUserId: transaction.user_id,
            buyerUserId: transaction.buyer_id 
          }
        });
        
        if (emailError) {
          logger.error('Error from get-user-emails:', emailError);
        }
        
        if (emailData) {
          sellerEmail = emailData.sellerEmail;
          buyerEmail = emailData.buyerEmail;
          logger.log('Emails retrieved:', { sellerEmail: !!sellerEmail, buyerEmail: !!buyerEmail });
        } else {
          logger.warn('No email data returned from get-user-emails');
        }
      } catch (error) {
        logger.error('Exception calling get-user-emails:', error);
      }
      
      // Fallback: si l'utilisateur connecté est un des participants, on peut utiliser son email
      if (!sellerEmail && currentUser?.id === transaction.user_id) {
        sellerEmail = currentUser.email;
        logger.log('Using current user email as seller fallback');
      }
      if (!buyerEmail && currentUser?.id === transaction.buyer_id) {
        buyerEmail = currentUser.email;
        logger.log('Using current user email as buyer fallback');
      }

      const userRole = getUserRole(transaction);
      const sellerName = sellerProfileFinal 
        ? (sellerProfileFinal.user_type === 'company' && sellerProfileFinal.company_name
            ? sellerProfileFinal.company_name
            : (`${sellerProfileFinal.first_name || ''} ${sellerProfileFinal.last_name || ''}`.trim() || 'Vendeur'))
        : (transaction.seller_display_name || 'Vendeur');
      
      const buyerName = buyerProfileFinal
        ? (buyerProfileFinal.user_type === 'company' && buyerProfileFinal.company_name
            ? buyerProfileFinal.company_name
            : (`${buyerProfileFinal.first_name || ''} ${buyerProfileFinal.last_name || ''}`.trim() || 'Client'))
        : transaction.buyer_display_name || 'Client anonyme';

      // Récupérer les détails du devis si disponible
      let quoteData: any = null;
      try {
        const { data } = await supabase
          .from('quotes')
          .select('items, subtotal, tax_rate, tax_amount, discount_percentage')
          .eq('converted_transaction_id', transaction.id)
          .maybeSingle();
        
        if (data) {
          quoteData = data;
        }
      } catch (error) {
        logger.warn('Could not fetch quote data for invoice:', error);
      }

      const transactionData = transaction as any;
      
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
        sellerProfile: sellerProfileFinal,
        buyerProfile: buyerProfileFinal,
        sellerEmail,
        buyerEmail,
        refundStatus: transaction.refund_status || 'none',
        refundPercentage: transaction.refund_percentage || null,
        // Nouveaux champs pour items et détails
        items: transactionData.items?.length > 0 ? transactionData.items : quoteData?.items,
        subtotal: quoteData?.subtotal,
        discount_percentage: quoteData?.discount_percentage,
        tax_rate: quoteData?.tax_rate,
        tax_amount: quoteData?.tax_amount,
      };

      generateInvoicePDF({
        ...invoiceData,
        language: i18n.language,
        t,
        viewerRole: userRole,
      });
    } catch (error) {
      logger.error('Erreur lors de la génération de la facture:', error);
      toast.error(t('transactions.invoiceError'));
    }
  };



  return (
    <DashboardLayoutWithSidebar onSyncPayments={handleSyncPayments}>
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
          <TabsTrigger value="pending" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''} relative`}>
            <Clock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `${t('transactions.waiting')} (${pendingTransactions.length})` : `${t('transactions.pending')} (${pendingTransactions.length})`}
            </span>
            <div className="flex items-center gap-1">
              {newCounts.pending > 0 && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-300 hover:bg-blue-500/20">
                  <Bell className="h-3 w-3 mr-1" />
                  {newCounts.pending}
                </Badge>
              )}
              {tabCounts.pending > 0 && (
                <Badge className="bg-blue-600 text-white hover:bg-blue-700">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {tabCounts.pending}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger value="blocked" className={`flex items-center gap-2 ${isMobile ? 'flex-col py-3' : ''} relative`}>
            <Lock className="h-4 w-4" />
            <span className={isMobile ? 'text-xs' : ''}>
              {isMobile ? `${t('transactions.blockedShort')} (${blockedTransactions.length})` : `${t('transactions.blocked')} (${blockedTransactions.length})`}
            </span>
            <div className="flex items-center gap-1">
              {newCounts.blocked > 0 && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-300 hover:bg-orange-500/20">
                  <Bell className="h-3 w-3 mr-1" />
                  {newCounts.blocked}
                </Badge>
              )}
              {tabCounts.blocked > 0 && (
                <Badge className="bg-orange-600 text-white hover:bg-orange-700">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {tabCounts.blocked}
                </Badge>
              )}
            </div>
          </TabsTrigger>
          {!isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2 relative">
                <CheckCircle2 className="h-4 w-4" />
                {t('transactions.completed')} ({completedTransactions.length})
                <div className="flex items-center gap-1">
                  {newCounts.completed > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-300 hover:bg-green-500/20">
                      <Bell className="h-3 w-3 mr-1" />
                      {newCounts.completed}
                    </Badge>
                  )}
                  {tabCounts.completed > 0 && (
                    <Badge className="bg-green-600 text-white hover:bg-green-700">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {tabCounts.completed}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2 relative">
                <AlertTriangle className="h-4 w-4" />
                {t('transactions.disputed')} ({disputedTransactions.length})
                <div className="flex items-center gap-1">
                  {newCounts.disputed > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-300 hover:bg-red-500/20">
                      <Bell className="h-3 w-3 mr-1" />
                      {newCounts.disputed}
                    </Badge>
                  )}
                  {unreadDisputeMsgs > 0 && (
                    <Badge className="bg-red-600 text-white hover:bg-red-700">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {unreadDisputeMsgs}
                    </Badge>
                  )}
                  {unreadAdminMessages > 0 && (
                    <Badge variant="destructive" className="bg-purple-600 text-white hover:bg-purple-700">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      {unreadAdminMessages}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
            </>
          )}
          {isMobile && (
            <>
              <TabsTrigger value="completed" className="flex items-center gap-2 flex-col py-3 relative">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs">{t('transactions.completed')} ({completedTransactions.length})</span>
                <div className="flex items-center gap-1">
                  {newCounts.completed > 0 && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-300 hover:bg-green-500/20 text-[10px] h-5 px-1.5">
                      <Bell className="h-2.5 w-2.5 mr-0.5" />
                      {newCounts.completed}
                    </Badge>
                  )}
                  {tabCounts.completed > 0 && (
                    <Badge className="bg-green-600 text-white hover:bg-green-700 text-[10px] h-5 px-1.5">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      {tabCounts.completed}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
              <TabsTrigger value="disputed" className="flex items-center gap-2 flex-col py-3 relative">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">{t('transactions.disputed')} ({disputedTransactions.length})</span>
                <div className="flex items-center gap-1">
                  {newCounts.disputed > 0 && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-300 hover:bg-red-500/20 text-[10px] h-5 px-1.5">
                      <Bell className="h-2.5 w-2.5 mr-0.5" />
                      {newCounts.disputed}
                    </Badge>
                  )}
                  {unreadDisputeMsgs > 0 && (
                    <Badge className="bg-red-600 text-white hover:bg-red-700 text-[10px] h-5 px-1.5">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      {unreadDisputeMsgs}
                    </Badge>
                  )}
                  {unreadAdminMessages > 0 && (
                    <Badge variant="destructive" className="bg-purple-600 text-white hover:bg-purple-700 text-[10px] h-5 px-1.5">
                      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                      {unreadAdminMessages}
                    </Badge>
                  )}
                </div>
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader className="pb-3">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
                <div className="flex-1">
                  <CardTitle>{t('transactions.pendingTransactions')}</CardTitle>
                  <CardDescription className="mt-1.5">
                    {t('transactions.pendingDescription')}
                  </CardDescription>
                </div>
                <div className={isMobile ? 'w-full' : ''}>
                  <SortButtons sortBy={sortBy} sortOrder={sortOrder} onSortChange={updateSort} isMobile={isMobile} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonLayouts.TransactionCard key={i} />
                  ))}
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
                <>
                  {pendingTransactions.length > 20 ? (
                    <VirtualTransactionList
                      transactions={pendingTransactions}
                      user={user}
                      transactionsWithNewActivity={transactionsWithNewActivity}
                      onCopyLink={handleCopyLink}
                      onPayment={handlePayment}
                      onRefetch={refetch}
                      onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                      onDownloadInvoice={handleDownloadInvoice}
                      onDeleteExpired={handleDeleteExpiredTransaction}
                      onRenewExpired={handleRenewExpiredTransaction}
                      CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                    />
                  ) : (
                    <LocalErrorBoundary onRetry={refetch}>
                      <div className="space-y-4">
                        {pendingTransactions.map(transaction => (
                          <div key={transaction.id} id={`transaction-${transaction.id}`} className="transition-all duration-300">
                            <TransactionCard
                              transaction={transaction}
                              user={user}
                              showActions={true}
                              hasNewActivity={transactionsWithNewActivity?.has(transaction.id)}
                              onCopyLink={handleCopyLink}
                              onPayment={handlePayment}
                              onRefetch={refetch}
                              onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                              onDownloadInvoice={handleDownloadInvoice}
                              onDeleteExpired={handleDeleteExpiredTransaction}
                              onRenewExpired={handleRenewExpiredTransaction}
                              CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                            />
                          </div>
                        ))}
                      </div>
                    </LocalErrorBoundary>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader className="pb-3">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
                <div className="flex-1">
                  <CardTitle>Fonds bloqués</CardTitle>
                  <CardDescription className="mt-1.5">
                    Transactions avec paiement effectué, en attente de validation
                  </CardDescription>
                </div>
                <div className={isMobile ? 'w-full' : ''}>
                  <SortButtons sortBy={sortBy} sortOrder={sortOrder} onSortChange={updateSort} isMobile={isMobile} />
                </div>
              </div>
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
                <>
                  {blockedTransactions.length > 20 ? (
                    <VirtualTransactionList
                      transactions={blockedTransactions}
                      user={user}
                      transactionsWithNewActivity={transactionsWithNewActivity}
                      onCopyLink={handleCopyLink}
                      onPayment={handlePayment}
                      onRefetch={refetch}
                      onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                      onDownloadInvoice={handleDownloadInvoice}
                      onDeleteExpired={handleDeleteExpiredTransaction}
                      onRenewExpired={handleRenewExpiredTransaction}
                      CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                    />
                  ) : (
                    <LocalErrorBoundary onRetry={refetch}>
                      <div className="space-y-4">
                        {blockedTransactions.map(transaction => (
                          <div key={transaction.id} id={`transaction-${transaction.id}`} className="transition-all duration-300">
                            <TransactionCard
                              transaction={transaction}
                              user={user}
                              showActions={true}
                              hasNewActivity={transactionsWithNewActivity?.has(transaction.id)}
                              onCopyLink={handleCopyLink}
                              onPayment={handlePayment}
                              onRefetch={refetch}
                              onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                              onDownloadInvoice={handleDownloadInvoice}
                              onDeleteExpired={handleDeleteExpiredTransaction}
                              onRenewExpired={handleRenewExpiredTransaction}
                              CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                            />
                          </div>
                        ))}
                      </div>
                    </LocalErrorBoundary>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader className="pb-3">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
                <div className="flex-1">
                  <CardTitle>Transactions complétées</CardTitle>
                  <CardDescription className="mt-1.5">
                    Transactions validées et terminées
                  </CardDescription>
                </div>
                <div className={isMobile ? 'w-full' : ''}>
                  <SortButtons 
                    sortBy={sortBy} 
                    sortOrder={sortOrder} 
                    onSortChange={updateSort} 
                    isMobile={isMobile}
                    options={[
                      { value: 'created_at', label: t('transactions.sort.creation'), icon: Clock },
                      { value: 'funds_released_at', label: t('transactions.sort.completed'), icon: CheckCircle2 },
                    ]}
                  />
                </div>
              </div>
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
                <>
                  {completedTransactions.length > 20 ? (
                    <VirtualTransactionList
                      transactions={completedTransactions}
                      user={user}
                      transactionsWithNewActivity={transactionsWithNewActivity}
                      onCopyLink={handleCopyLink}
                      onPayment={handlePayment}
                      onRefetch={refetch}
                      onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                      onDownloadInvoice={handleDownloadInvoice}
                      onDeleteExpired={handleDeleteExpiredTransaction}
                      onRenewExpired={handleRenewExpiredTransaction}
                      CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                    />
                  ) : (
                    <LocalErrorBoundary onRetry={refetch}>
                      <div className="space-y-4">
                        {completedTransactions.map(transaction => (
                          <div key={transaction.id} id={`transaction-${transaction.id}`} className="transition-all duration-300">
                            <TransactionCard
                              transaction={transaction}
                              user={user}
                              showActions={true}
                              hasNewActivity={transactionsWithNewActivity?.has(transaction.id)}
                              onCopyLink={handleCopyLink}
                              onPayment={handlePayment}
                              onRefetch={refetch}
                              onOpenDispute={(tx) => setDisputeDialog({ open: true, transaction: tx })}
                              onDownloadInvoice={handleDownloadInvoice}
                              onDeleteExpired={handleDeleteExpiredTransaction}
                              onRenewExpired={handleRenewExpiredTransaction}
                              CompleteButtonComponent={CompleteTransactionButtonWithStatus}
                            />
                          </div>
                        ))}
                      </div>
                    </LocalErrorBoundary>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputed">
          <Card>
            <CardHeader className="pb-3">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-start'}`}>
                <div className="flex-1">
                  <CardTitle>{t('transactions.disputed')}</CardTitle>
                  <CardDescription className="mt-1.5">
                    {t('transactions.disputedDescription')}
                  </CardDescription>
                </div>
                <div className={isMobile ? 'w-full' : ''}>
                  <SortButtons sortBy={sortBy} sortOrder={sortOrder} onSortChange={updateSort} isMobile={isMobile} />
                </div>
              </div>
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
                      <div key={dispute.id} id={`transaction-${dispute.transaction_id}`} className="transition-all duration-300">
                        <DisputeCard
                          dispute={dispute}
                          onRefetch={() => {
                            refetch();
                            refetchDisputes();
                          }}
                        />
                      </div>
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
    </DashboardLayoutWithSidebar>
  );
}