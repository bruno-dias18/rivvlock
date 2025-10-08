import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStripeAccount, useCreateStripeAccount } from '@/hooks/useStripeAccount';
import { AlertCircle, CheckCircle, ExternalLink, CreditCard, Clock, Settings, RefreshCw, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { PaymentTimingInfo } from '@/components/PaymentTimingInfo';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { logger } from '@/lib/logger';

export default function BankAccountSetupCard() {
  const { data: stripeAccount, isLoading, refetch, error, isError } = useStripeAccount();
  const createAccount = useCreateStripeAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const isSessionExpired = error instanceof Error && error.message === 'SESSION_EXPIRED';

  const getLastCheckText = () => {
    if (!stripeAccount?.last_check) return null;
    try {
      const date = new Date(stripeAccount.last_check);
      return formatDistanceToNow(date, { addSuffix: true, locale: fr });
    } catch {
      return null;
    }
  };

  const handleReconnect = async () => {
    await logout();
    navigate('/auth');
    toast.info('Veuillez vous reconnecter');
  };

  const handleCreateAccount = async () => {
    try {
      setIsProcessing(true);
      
      const result = await createAccount.mutateAsync();
      
      if (result.onboarding_url) {
        // Rediriger dans le même onglet
        if (result.recreated) {
          toast.success(t('bankAccount.accountRecreated'));
        } else {
          toast.success(t('bankAccount.redirectingToStripe'));
        }
        window.location.href = result.onboarding_url;
      } else {
        if (result.existing) {
          toast.info(t('bankAccount.accountAlreadyActive'));
          refetch();
        }
      }
    } catch (error) {
      logger.error('Error creating Stripe account:', error);
      toast.error(t('bankAccount.createError'));
      setIsProcessing(false);
    }
  };

  const handleCompleteOnboarding = () => {
    // Always generate a fresh account_update link instead of using a possibly stale onboarding_url
    // Reuse the same flow as modification to ensure partial completion
    void handleModifyBankDetails();
  };

  const handleRefreshStatus = () => {
    refetch();
    toast.info(t('bankAccount.statusUpdated'));
  };

  const handleModifyBankDetails = async () => {
    try {
      setIsProcessing(true);

      // 1) Essayer update-stripe-account-info
      const { data: updateData, error: updateErr } = await supabase.functions.invoke('update-stripe-account-info');
      
      let finalUrl: string | null = null;
      
      // 2) Si succès ET url présente → utiliser directement
      if (!updateErr && updateData?.success === true && updateData?.url) {
        finalUrl = updateData.url;
      } else {
        // 3) Sinon → fallback vers create-stripe-account
        logger.error('update-stripe-account-info failed, trying fallback', { updateErr, updateData });
        
        const { data: createData, error: createErr } = await supabase.functions.invoke('create-stripe-account');
        if (createErr || !createData?.onboarding_url) {
          logger.error('create-stripe-account error:', createErr);
          toast.error('Erreur: ' + (createErr?.message || 'Impossible de créer le compte Stripe'));
          setIsProcessing(false);
          return;
        }
        
        finalUrl = createData.onboarding_url;
      }
      
      // 4) Rediriger
      if (finalUrl) {
        toast.success('Redirection vers Stripe...');
        window.location.href = finalUrl;
      } else {
        logger.error('No URL received from either function');
        toast.error('Aucune URL reçue de Stripe');
        setIsProcessing(false);
      }
    } catch (error) {
      logger.error('Unexpected error:', error);
      toast.error('Erreur inattendue');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t('bankAccount.title')}
          </CardTitle>
          <CardDescription>
            {t('activity.configurationInProgress')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if Stripe requires more information
  const needsMoreInfo = stripeAccount?.has_account && (
    !stripeAccount.details_submitted || 
    !stripeAccount.charges_enabled || 
    !stripeAccount.payouts_enabled || 
    stripeAccount.account_status === 'pending'
  );

  return (
    <Card className={needsMoreInfo ? "border-amber-500 border-2" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {t('bankAccount.title')}
        </CardTitle>
        <CardDescription>
          {t('bankAccount.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsMoreInfo && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="space-y-3">
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {t('bankAccount.verificationRequired')}
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('bankAccount.verificationRequiredMessage')}
              </p>
              <Button 
                onClick={stripeAccount.onboarding_url ? handleCompleteOnboarding : handleModifyBankDetails}
                disabled={isProcessing}
                size="sm"
                className="mt-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isProcessing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    {t('bankAccount.processingInProgress')}
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t('bankAccount.completeNow')}
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {isSessionExpired 
                  ? 'Votre session a expiré. Veuillez vous reconnecter.' 
                  : `${t('bankAccount.connectionError')}: ${error?.message || t('bankAccount.unknownError')}`
                }
              </span>
              {isSessionExpired ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReconnect}
                  className="ml-2"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Se reconnecter
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetch()}
                  className="ml-2"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t('bankAccount.retry')}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {!stripeAccount?.has_account ? (
          // No account exists
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('bankAccount.setupRequired')}
              </AlertDescription>
            </Alert>
            
            <PaymentTimingInfo />
            
            <Button 
              onClick={handleCreateAccount}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Connexion à Stripe...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('bankAccount.setupButton')}
                </>
              )}
            </Button>
          </div>
        ) : (
          // Account exists - show status
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">{t('bankAccount.accountStatus')}</label>
                  <div className="mt-1">
                    {stripeAccount.account_status === 'active' ? (
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('bankAccount.active')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {t('bankAccount.pending')}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshStatus}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('bankAccount.refresh')}
                </Button>
              </div>
              
              {getLastCheckText() && (
                <p className="text-xs text-muted-foreground">
                  Dernière vérification: {getLastCheckText()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium">{t('bankAccount.detailsSubmitted')}</label>
                <p className={stripeAccount.details_submitted ? "text-green-600" : "text-orange-600 font-semibold"}>
                  {stripeAccount.details_submitted ? t('bankAccount.complete') : `⚠ ${t('bankAccount.incomplete')} - ${t('bankAccount.documentsRequired')}`}
                </p>
              </div>
              <div>
                <label className="font-medium">{t('bankAccount.chargesEnabled')}</label>
                <p className={stripeAccount.charges_enabled ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.charges_enabled ? t('bankAccount.enabled') : t('bankAccount.disabled')}
                </p>
              </div>
              <div>
                <label className="font-medium">{t('bankAccount.payoutsEnabled')}</label>
                <p className={stripeAccount.payouts_enabled ? "text-green-600" : "text-orange-600 font-semibold"}>
                  {stripeAccount.payouts_enabled ? t('bankAccount.enabled') : `⚠ ${t('bankAccount.disabled')} - ${t('bankAccount.payoutsBlocked')}`}
                </p>
              </div>
            </div>

            {stripeAccount.onboarding_required && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('bankAccount.onboardingRequiredAlert')}
                </AlertDescription>
              </Alert>
            )}

            {stripeAccount.onboarding_required ? (
              <Button 
                onClick={handleCompleteOnboarding}
                className="w-full"
                variant="default"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {t('bankAccount.completeOnboarding')}
              </Button>
            ) : (
              <div className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('bankAccount.setupCompleteAlert')}
                  </AlertDescription>
                </Alert>

                <PaymentTimingInfo />

                {stripeAccount.account_status === 'active' && (
                  <Button 
                    onClick={handleModifyBankDetails}
                    disabled={isProcessing}
                    className="w-full"
                    variant="outline"
                  >
                    {isProcessing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Connexion à Stripe...
                      </>
                    ) : (
                      <>
                        <Settings className="h-4 w-4 mr-2" />
                        {t('bankAccount.modifyBankDetails')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}