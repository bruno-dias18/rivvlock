import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const stripePromise = loadStripe('pk_test_51S8e6YHnSTKmmIwR2aSbtHog8WNMpe69KLlF4LsNFuWsjazTKV4XCyTCDMR5BeTC6njQ7Xqe8tgniTv3mW0NRIvS00iuXka3W8');

interface EmbeddedStripeOnboardingProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function EmbeddedStripeOnboarding({ onSuccess, onCancel }: EmbeddedStripeOnboardingProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountCreate, setAccountCreate] = useState<any>(null);

  useEffect(() => {
    const initializeOnboarding = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Create Stripe account first
        const { data: accountData, error: accountError } = await supabase.functions.invoke('create-stripe-account');
        
        if (accountError) {
          throw accountError;
        }

        if (accountData.error) {
          throw new Error(accountData.error);
        }

        // Now check account status to get onboarding URL or verify completion
        const { data: statusData, error: statusError } = await supabase.functions.invoke('check-stripe-account-status');
        
        if (statusError) {
          throw statusError;
        }

        if (statusData.error) {
          throw new Error(statusData.error);
        }

        // If account is already fully set up
        if (statusData.charges_enabled && statusData.payouts_enabled) {
          toast.success('Configuration terminée avec succès !');
          onSuccess();
          return;
        }

        // If we have an onboarding URL, open it
        if (statusData.onboarding_url) {
          // Open Stripe onboarding in new tab
          window.open(statusData.onboarding_url, '_blank');
          
          setIsLoading(false);
          
          // Set up polling to check account status
          const pollAccountStatus = setInterval(async () => {
            try {
              const { data: pollStatusData } = await supabase.functions.invoke('check-stripe-account-status');
              if (pollStatusData?.charges_enabled && pollStatusData?.payouts_enabled) {
                clearInterval(pollAccountStatus);
                toast.success('Configuration terminée avec succès !');
                onSuccess();
              }
            } catch (error) {
              console.error('Error polling account status:', error);
            }
          }, 3000); // Poll every 3 seconds

          // Clean up polling after 5 minutes
          setTimeout(() => {
            clearInterval(pollAccountStatus);
          }, 300000);
        } else {
          throw new Error('URL d\'onboarding non disponible');
        }

      } catch (err: any) {
        console.error('Error initializing Stripe onboarding:', err);
        setError(err.message || 'Erreur lors de l\'initialisation');
        setIsLoading(false);
      }
    };

    initializeOnboarding();

    // Cleanup
    return () => {};
  }, [onSuccess, onCancel]);

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel}>
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Ouverture du formulaire de configuration Stripe...
          </p>
        </div>
      )}
      
      {!isLoading && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">
            Le formulaire de configuration s'est ouvert dans un nouvel onglet. 
            Veuillez compléter votre configuration sur Stripe et revenir ici.
          </p>
          <p className="text-xs text-muted-foreground">
            Cette fenêtre se fermera automatiquement une fois la configuration terminée.
          </p>
        </div>
      )}
      
      <div className="flex justify-end">
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}