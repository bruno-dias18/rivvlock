import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStripeAccount, useCreateStripeAccount } from '@/hooks/useStripeAccount';
import { AlertCircle, CheckCircle, ExternalLink, CreditCard, Clock, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export default function BankAccountSetupCard() {
  const { data: stripeAccount, isLoading, refetch } = useStripeAccount();
  const createAccount = useCreateStripeAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useTranslation();

  const handleCreateAccount = async () => {
    try {
      setIsProcessing(true);
      const result = await createAccount.mutateAsync();
      
      if (result.onboarding_url) {
        // Open Stripe onboarding in new tab
        window.open(result.onboarding_url, '_blank');
        toast.success(t('bankAccount.onboardingOpened'));
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      toast.error(t('bankAccount.createError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteOnboarding = () => {
    if (stripeAccount?.onboarding_url) {
      window.open(stripeAccount.onboarding_url, '_blank');
      toast.info(t('bankAccount.onboardingOpened'));
    }
  };

  const handleRefreshStatus = () => {
    refetch();
    toast.info(t('bankAccount.statusUpdated'));
  };

  const handleModifyBankDetails = async () => {
    try {
      setIsProcessing(true);
      console.log('Starting bank details modification...');
      
      const { data, error } = await supabase.functions.invoke('update-stripe-account-info');
      
      console.log('Bank details modification response:', { data, error });
      
      if (error) {
        console.error('Edge function error:', error);
        // Check if it's an account not found error
        if (error.message?.includes('account not found') || error.message?.includes('No account found')) {
          toast.error(t('bankAccount.accountNotFound'));
          // Refetch to update the UI state
          refetch();
          return;
        }
        throw error;
      }
      
      if (data?.success && data?.url) {
        console.log('Opening account modification URL:', data.url);
        window.open(data.url, '_blank');
        toast.success(t('bankAccount.modificationOpened'));
      } else {
        console.error('Invalid response data:', data);
        throw new Error('No URL returned from edge function');
      }
    } catch (error) {
      console.error('Error opening bank details modification:', error);
      toast.error(t('bankAccount.modificationError'));
    } finally {
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

  return (
    <Card>
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
        {!stripeAccount?.has_account ? (
          // No account exists
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('bankAccount.setupRequired')}
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={handleCreateAccount}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  {t('bankAccount.processingInProgress')}
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
                {t('bankAccount.refresh')}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium">{t('bankAccount.detailsSubmitted')}</label>
                <p className={stripeAccount.details_submitted ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.details_submitted ? t('bankAccount.complete') : t('bankAccount.incomplete')}
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
                <p className={stripeAccount.payouts_enabled ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.payouts_enabled ? t('bankAccount.enabled') : t('bankAccount.disabled')}
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
                        {t('bankAccount.processingInProgress')}
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

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            <strong>Note :</strong> {t('bankAccount.commissionNote')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}