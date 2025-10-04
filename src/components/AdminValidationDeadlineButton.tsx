import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

export function AdminValidationDeadlineButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{
    processed: number;
    errors: number;
    total: number;
  } | null>(null);

  const handleProcessDeadlines = async () => {
    setIsProcessing(true);
    setLastResult(null);
    
    try {
      logger.log('[AdminValidationDeadline] Calling process-validation-deadline...');
      
      const { data, error } = await supabase.functions.invoke('process-validation-deadline', {
        body: {}
      });

      if (error) {
        logger.error('[AdminValidationDeadline] Error:', error);
        toast.error('Erreur lors du traitement des deadlines', {
          description: error.message || 'Une erreur est survenue'
        });
        return;
      }

      logger.log('[AdminValidationDeadline] Success:', data);
      setLastResult(data);

      if (data.processed === 0) {
        toast.info('Aucune transaction à traiter', {
          description: 'Aucune deadline expirée trouvée'
        });
      } else {
        toast.success(`${data.processed} transaction(s) finalisée(s)`, {
          description: data.errors > 0 
            ? `${data.errors} erreur(s) rencontrée(s)` 
            : 'Fonds libérés automatiquement'
        });
      }
    } catch (error) {
      logger.error('[AdminValidationDeadline] Unexpected error:', error);
      toast.error('Erreur inattendue', {
        description: 'Impossible de traiter les deadlines'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>Validation Automatique</span>
        </CardTitle>
        <CardDescription>
          Finaliser manuellement les transactions dont le délai de validation a expiré
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lastResult && (
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transactions traitées:</span>
              <span className="font-bold text-green-600">{lastResult.processed}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total trouvées:</span>
              <span className="font-medium">{lastResult.total}</span>
            </div>
            {lastResult.errors > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Erreurs:</span>
                <span className="font-bold text-red-600">{lastResult.errors}</span>
              </div>
            )}
          </div>
        )}

        <Button 
          onClick={handleProcessDeadlines}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Traitement en cours...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Lancer le traitement manuel
            </>
          )}
        </Button>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Cette fonction traite automatiquement toutes les transactions où le délai de validation (48h) est expiré. 
              Un cron job exécute également ce traitement toutes les heures automatiquement.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
