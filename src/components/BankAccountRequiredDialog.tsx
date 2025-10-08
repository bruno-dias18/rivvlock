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
  const { refetch } = useStripeAccount();

const handleStartSetup = async () => {
  // Ouvre un nouvel onglet tout de suite pour éviter les bloqueurs de popups
  const newTab = window.open('', '_blank');
  try {
    // 1) D'abord essayer update-stripe-account-info (gère à la fois update et onboarding)
    const { data: updateData, error: updateErr } = await supabase.functions.invoke('update-stripe-account-info');
    
    if (updateErr) {
      logger.error('update-stripe-account-info error:', updateErr);
    }

    if (updateData?.url) {
      if (newTab) newTab.location.href = updateData.url; else window.location.href = updateData.url;
      toast.success('Formulaire Stripe ouvert');
      return;
    }

    // 2) Si update-stripe-account-info indique "pas de compte", créer un nouveau compte
    if (updateData?.error && updateData.error.includes('No Stripe account found')) {
      const { data: createData, error: createErr } = await supabase.functions.invoke('create-stripe-account');
      if (createErr) {
        logger.error('create-stripe-account error:', createErr);
        toast.error('Erreur: ' + (createErr.message || 'Impossible de créer le compte Stripe'));
        if (newTab) newTab.close();
        return;
      }

      if (createData?.onboarding_url) {
        if (newTab) newTab.location.href = createData.onboarding_url; else window.location.href = createData.onboarding_url;
        toast.success('Formulaire Stripe ouvert');
        return;
      }
    }

    // 3) Aucun lien retourné
    logger.error('No onboarding/update URL returned');
    toast.error('Aucune URL reçue de Stripe');
    if (newTab) newTab.close();
  } catch (err) {
    logger.error('Unexpected error opening Stripe flow:', err);
    toast.error('Erreur inattendue');
    if (newTab) newTab.close();
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
            Vous devez configurer vos coordonnées bancaires avant de pouvoir créer une transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!showOnboarding && !isSetupComplete && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Pour créer une transaction et recevoir des paiements, vous devez d'abord 
                  configurer vos coordonnées bancaires avec Stripe. Cette étape garantit 
                  que les fonds peuvent être automatiquement transférés sur votre compte 
                  après chaque transaction complétée.
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

              <div className="flex justify-end space-x-3">
                <Button variant="outline" onClick={handleCancel}>
                  Annuler
                </Button>
                <Button onClick={handleStartSetup}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Configurer maintenant
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