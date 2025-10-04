import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function ProcessValidationDeadlinesButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [expiredCount, setExpiredCount] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Compter les transactions avec délai expiré
  const fetchExpiredCount = async () => {
    const { count } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('seller_validated', true)
      .eq('buyer_validated', false)
      .eq('funds_released', false)
      .not('validation_deadline', 'is', null)
      .lt('validation_deadline', new Date().toISOString())
      .eq('status', 'paid');
    
    setExpiredCount(count || 0);
  };

  // Appeler la fonction edge pour traiter les validations expirées
  const handleProcess = async () => {
    setIsProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-validation-deadline', {
        body: {}
      });

      if (error) throw error;

      const processed = data?.processed || 0;
      const errors = data?.errors || 0;

      if (processed > 0) {
        toast.success('Traitement terminé', {
          description: `${processed} transaction(s) finalisée(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`,
        });
      } else {
        toast.error('Aucune transaction traitée', {
          description: errors > 0 ? `${errors} erreur(s) rencontrée(s)` : 'Aucune transaction à traiter',
        });
      }

      // Rafraîchir les données
      await fetchExpiredCount();
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      
    } catch (error) {
      console.error('Erreur lors du traitement:', error);
      toast.error('Erreur', {
        description: error instanceof Error ? error.message : 'Impossible de traiter les validations expirées',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Charger le compte au montage
  useEffect(() => {
    fetchExpiredCount();
  }, []);

  return (
    <div className="space-y-3">
      <Button
        onClick={handleProcess}
        disabled={isProcessing || expiredCount === 0}
        className="w-full"
        variant="outline"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Traitement en cours...
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 mr-2" />
            Traiter les validations expirées
            {expiredCount !== null && expiredCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-destructive text-destructive-foreground rounded-full">
                {expiredCount}
              </span>
            )}
          </>
        )}
      </Button>
      
      {expiredCount !== null && (
        <p className="text-xs text-muted-foreground text-center">
          {expiredCount === 0
            ? 'Aucune transaction expirée en attente'
            : `${expiredCount} transaction(s) avec délai expiré`
          }
        </p>
      )}
    </div>
  );
}
