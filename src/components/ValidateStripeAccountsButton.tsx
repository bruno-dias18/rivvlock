import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ValidationResult {
  success: boolean;
  summary?: {
    total_accounts: number;
    validated: number;
    marked_inactive: number;
    errors: number;
  };
  message?: string;
  error?: string;
}

export function ValidateStripeAccountsButton() {
  const [isValidating, setIsValidating] = useState(false);

  const handleValidation = async () => {
    setIsValidating(true);
    
    try {
      toast.info("Validation des comptes Stripe en cours...");
      
      const { data, error } = await supabase.functions.invoke<ValidationResult>('validate-stripe-accounts');
      
      if (error) {
        logger.error('Validation error:', error);
        toast.error(`Erreur lors de la validation : ${error.message}`);
        return;
      }

      if (data?.success && data.summary) {
        const { total_accounts, validated, marked_inactive, errors } = data.summary;
        
        if (errors > 0) {
          toast.warning(
            `Validation terminée avec ${errors} erreur(s)`,
            {
              description: `${validated} comptes validés, ${marked_inactive} marqués comme inactifs sur ${total_accounts} comptes`
            }
          );
        } else if (marked_inactive > 0) {
          toast.warning(
            `${marked_inactive} compte(s) inactif(s) détecté(s)`,
            {
              description: `${validated} comptes validés, ${marked_inactive} comptes Stripe supprimés détectés`
            }
          );
        } else {
          toast.success(
            "Tous les comptes Stripe sont valides",
            {
              description: `${validated} comptes validés avec succès`
            }
          );
        }
      } else {
        toast.error(`Erreur : ${data?.error || 'Réponse inattendue'}`);
      }
      
    } catch (error) {
      logger.error('Unexpected error:', error);
      toast.error("Erreur inattendue lors de la validation");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Button
      onClick={handleValidation}
      disabled={isValidating}
      variant="outline"
      className="gap-2"
    >
      {isValidating ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Validation en cours...
        </>
      ) : (
        <>
          <CheckCircle className="h-4 w-4" />
          Valider les comptes Stripe
        </>
      )}
    </Button>
  );
}