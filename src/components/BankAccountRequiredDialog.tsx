import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { EmbeddedStripeOnboarding } from './EmbeddedStripeOnboarding';
import { useStripeAccount } from '@/hooks/useStripeAccount';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
interface BankAccountRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete: () => void;
}

export function BankAccountRequiredDialog({ 
  open, 
  onOpenChange, 
  onSetupComplete 
}: BankAccountRequiredDialogProps) {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { refetch } = useStripeAccount();

const handleStartSetup = async () => {
  setIsLoading(true);
  try {
    const { data: updateData, error: updateErr } = await supabase.functions.invoke('update-stripe-account-info');
    
    let stripeUrl = null;
    
    // Si erreur réseau ou pas de données, essayer create-stripe-account immédiatement
    if (updateErr || !updateData) {
      logger.error('update-stripe-account-info failed, trying fallback', { updateErr, updateData });
      
      const { data: createData, error: createErr } = await supabase.functions.invoke('create-stripe-account');
      if (createErr || !createData) {
        logger.error('create-stripe-account error:', createErr);
        toast.error('Erreur: ' + (createErr?.message || 'Impossible de créer le compte Stripe'));
        setIsLoading(false);
        return;
      }

      if (createData?.onboarding_url) {
        stripeUrl = createData.onboarding_url;
      } else {
        logger.error('No URL from create-stripe-account');
        toast.error('Aucune URL reçue de Stripe');
        setIsLoading(false);
        return;
      }
    } else if (updateData.url) {
      // Si succès avec URL depuis update
      stripeUrl = updateData.url;
    } else if (updateData.error) {
      // Si erreur depuis update-stripe-account-info, essayer fallback
      logger.error('update-stripe-account-info returned error, trying fallback:', updateData.error);
      
      const { data: createData, error: createErr } = await supabase.functions.invoke('create-stripe-account');
      if (createErr || !createData) {
        logger.error('create-stripe-account error:', createErr);
        toast.error('Erreur: ' + (createErr?.message || 'Impossible de créer le compte Stripe'));
        setIsLoading(false);
        return;
      }

      if (createData?.onboarding_url) {
        stripeUrl = createData.onboarding_url;
      } else {
        logger.error('No URL from create-stripe-account');
        toast.error('Aucune URL reçue de Stripe');
        setIsLoading(false);
        return;
      }
    } else {
      logger.error('No URL received from either function');
      toast.error('Aucune URL reçue de Stripe');
      setIsLoading(false);
      return;
    }

    // Rediriger dans le même onglet
    if (stripeUrl) {
      toast.success('Redirection vers Stripe...');
      // Utiliser location.href pour rester dans le même onglet
      window.location.href = stripeUrl;
    }
  } catch (err) {
    logger.error('Unexpected error opening Stripe flow:', err);
    toast.error('Erreur inattendue');
  } finally {
    setIsLoading(false);
  }
};
  const handleSetupSuccess = async () => {
    setIsSetupComplete(true);
    await refetch(); // Refresh account status
    setTimeout(() => {
      onSetupComplete();
      onOpenChange(false);
      setShowOnboarding(false);
      setIsSetupComplete(false);
    }, 2000);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setShowOnboarding(false);
    setIsSetupComplete(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Configuration bancaire requise
          </DialogTitle>
          <DialogDescription>
            Configurez Stripe pour recevoir vos paiements.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Connexion à Stripe en cours...</p>
            </div>
          )}

          {!showOnboarding && !isSetupComplete && !isLoading && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Pour créer une transaction, vous devez configurer votre compte Stripe.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h4 className="font-medium">Ce que vous devrez fournir :</h4>
                <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                  <li>• Coordonnées bancaires (IBAN, BIC)</li>
                  <li>• Informations personnelles ou d'entreprise</li>
                  <li>• Document d'identité</li>
                  <li>• Adresse de facturation</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Button variant="outline" onClick={handleCancel} className="w-full">
                  Annuler
                </Button>
                <Button onClick={handleStartSetup} className="w-full">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Configurer Stripe
                </Button>
              </div>
            </>
          )}

          {showOnboarding && !isSetupComplete && (
            <EmbeddedStripeOnboarding onSuccess={handleSetupSuccess} onCancel={handleCancel} />
          )}

          {isSetupComplete && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Configuration terminée !</h3>
              <p className="text-muted-foreground">
                Vos coordonnées bancaires ont été configurées avec succès. 
                Vous pouvez maintenant créer des transactions.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}