import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CreditCard, AlertCircle, CheckCircle2 } from 'lucide-react';
import { EmbeddedStripeOnboarding } from './EmbeddedStripeOnboarding';
import { useStripeAccount } from '@/hooks/useStripeAccount';

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

  const handleStartSetup = () => {
    setShowOnboarding(true);
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