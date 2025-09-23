import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStripeAccount, useCreateStripeAccount } from '@/hooks/useStripeAccount';
import { AlertCircle, CheckCircle, ExternalLink, CreditCard, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function BankAccountSetupCard() {
  const { data: stripeAccount, isLoading, refetch } = useStripeAccount();
  const createAccount = useCreateStripeAccount();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreateAccount = async () => {
    try {
      setIsProcessing(true);
      const result = await createAccount.mutateAsync();
      
      if (result.onboarding_url) {
        // Open Stripe onboarding in new tab
        window.open(result.onboarding_url, '_blank');
        toast.success('Processus d\'enregistrement Stripe ouvert dans un nouvel onglet');
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      toast.error('Erreur lors de la création du compte Stripe');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteOnboarding = () => {
    if (stripeAccount?.onboarding_url) {
      window.open(stripeAccount.onboarding_url, '_blank');
      toast.info('Processus d\'enregistrement Stripe ouvert dans un nouvel onglet');
    }
  };

  const handleRefreshStatus = () => {
    refetch();
    toast.info('Statut du compte mis à jour');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Coordonnées bancaires
          </CardTitle>
          <CardDescription>
            Configuration en cours...
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
          Coordonnées bancaires
        </CardTitle>
        <CardDescription>
          Configurez vos coordonnées bancaires pour recevoir les paiements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!stripeAccount?.has_account ? (
          // No account exists
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Vous devez configurer un compte Stripe Connect pour recevoir les paiements.
                Cette étape est nécessaire pour que l'argent soit automatiquement transféré
                sur votre compte bancaire après chaque transaction complétée.
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
                  Configuration en cours...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configurer mes coordonnées bancaires
                </>
              )}
            </Button>
          </div>
        ) : (
          // Account exists - show status
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Statut du compte</label>
                <div className="mt-1">
                  {stripeAccount.account_status === 'active' ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Actif - Prêt à recevoir des paiements
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Clock className="h-3 w-3 mr-1" />
                      En attente de configuration
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshStatus}
              >
                Actualiser
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium">Informations soumises</label>
                <p className={stripeAccount.details_submitted ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.details_submitted ? "✓ Complètes" : "⚠ Incomplètes"}
                </p>
              </div>
              <div>
                <label className="font-medium">Paiements activés</label>
                <p className={stripeAccount.charges_enabled ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.charges_enabled ? "✓ Activés" : "⚠ Désactivés"}
                </p>
              </div>
              <div>
                <label className="font-medium">Virements activés</label>
                <p className={stripeAccount.payouts_enabled ? "text-green-600" : "text-orange-600"}>
                  {stripeAccount.payouts_enabled ? "✓ Activés" : "⚠ Désactivés"}
                </p>
              </div>
            </div>

            {stripeAccount.onboarding_required && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Votre compte nécessite une configuration supplémentaire pour pouvoir 
                  recevoir des paiements. Cliquez sur le bouton ci-dessous pour terminer 
                  la configuration.
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
                Terminer la configuration
              </Button>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ✅ Votre compte est configuré ! Les fonds seront automatiquement 
                  transférés sur votre compte bancaire après chaque transaction complétée.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            <strong>Note :</strong> Une commission de 5% est prélevée sur chaque transaction 
            pour couvrir les frais de la plateforme et de traitement des paiements.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}