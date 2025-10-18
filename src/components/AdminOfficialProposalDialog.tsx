import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, FileText, Zap } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { logger } from '@/lib/logger';

interface AdminOfficialProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disputeId: string;
  onSuccess?: () => void;
}

export const AdminOfficialProposalDialog: React.FC<AdminOfficialProposalDialogProps> = ({
  open,
  onOpenChange,
  disputeId,
  onSuccess,
}) => {
  const [proposalType, setProposalType] = useState<'partial_refund' | 'full_refund' | 'no_refund'>('partial_refund');
  const [refundPercentage, setRefundPercentage] = useState<number>(50);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [immediateExecution, setImmediateExecution] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Veuillez ajouter un message explicatif");
      return;
    }

    if (proposalType === 'partial_refund' && (refundPercentage <= 0 || refundPercentage >= 100)) {
      toast.error("Le pourcentage doit être entre 1 et 99%");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-admin-proposal', {
        body: {
          disputeId,
          proposalType,
          refundPercentage: proposalType === 'partial_refund' ? refundPercentage : null,
          message: message.trim(),
          immediateExecution,
        },
      });

      if (error) throw error;

      if (immediateExecution) {
        toast.success("Décision exécutée immédiatement - Litige résolu");
      } else {
        toast.success("Proposition officielle envoyée aux deux parties");
      }
      onOpenChange(false);
      setMessage('');
      setRefundPercentage(50);
      setProposalType('partial_refund');
      setImmediateExecution(false);
      onSuccess?.();
    } catch (error) {
      logger.error('Error creating admin proposal:', error);
      toast.error("Erreur lors de la création de la proposition");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Créer une proposition officielle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-1 -mx-1">
          <div className={`${immediateExecution ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'} border p-4 rounded-lg transition-colors`}>
            <div className="flex items-start gap-2">
              {immediateExecution ? (
                <Zap className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              )}
              <div className={`text-sm ${immediateExecution ? 'text-red-900 dark:text-red-100' : 'text-purple-900 dark:text-purple-100'}`}>
                {immediateExecution ? (
                  <>
                    <p className="font-medium mb-1">⚡ Arbitrage immédiat - Exécution automatique</p>
                    <p>
                      Cette décision sera <strong>exécutée immédiatement</strong> sans validation des parties.
                      Le litige sera résolu instantanément selon vos instructions.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium mb-1">Proposition administrative officielle</p>
                    <p>
                      Cette proposition sera envoyée aux deux parties (acheteur et vendeur) qui devront
                      <strong> tous les deux valider</strong> pour que la solution soit appliquée automatiquement.
                    </p>
                    <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
                      ⏱️ Les parties auront 48 heures pour répondre.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
            <Checkbox
              id="immediate-execution"
              checked={immediateExecution}
              onCheckedChange={(checked) => setImmediateExecution(checked as boolean)}
            />
            <div className="flex-1">
              <Label 
                htmlFor="immediate-execution" 
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <Zap className="h-4 w-4 text-orange-600" />
                Arbitrage immédiat (exécution sans validation des parties)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                En cochant cette case, la décision sera appliquée immédiatement et le litige sera résolu automatiquement.
                Les parties seront notifiées de votre décision finale.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type de résolution *</Label>
            <Select
              value={proposalType}
              onValueChange={(value: any) => setProposalType(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partial_refund">
                  Remboursement partiel
                </SelectItem>
                <SelectItem value="full_refund">
                  Remboursement complet (100%)
                </SelectItem>
                <SelectItem value="no_refund">
                  Pas de remboursement (libérer les fonds au vendeur)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {proposalType === 'partial_refund' && (
            <div className="space-y-2">
              <Label>Pourcentage de remboursement *</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="1"
                  max="99"
                  value={refundPercentage}
                  onChange={(e) => setRefundPercentage(Number(e.target.value))}
                  className="max-w-[120px]"
                />
                <span className="text-sm text-muted-foreground">
                  (entre 1% et 99%)
                </span>
              </div>
              <div className="bg-muted/50 border rounded-lg p-3 text-xs space-y-1.5">
                <p className="font-medium text-foreground mb-2">💡 Calcul des montants :</p>
                <p className="text-muted-foreground">
                  • L'acheteur sera remboursé de <strong>{refundPercentage}%</strong> du montant de la transaction
                </p>
                <p className="text-muted-foreground">
                  • Le vendeur recevra <strong>{100 - refundPercentage}%</strong> du montant de la transaction
                </p>
                <p className="text-orange-600 dark:text-orange-400">
                  • Frais RivvLock (5%) : déduits du montant total, puis répartis proportionnellement entre les deux parties
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Exemple : Transaction 100€, remboursement {refundPercentage}% → Montant net 95€ → Acheteur: {(95 * refundPercentage / 100).toFixed(2)}€ | Vendeur: {(95 * (100 - refundPercentage) / 100).toFixed(2)}€
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Message explicatif pour les deux parties *</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Expliquez votre décision et les raisons de cette proposition..."
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Ce message sera visible par l'acheteur et le vendeur
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim()}
            className={immediateExecution ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {isSubmitting ? "Traitement en cours..." : immediateExecution ? "⚡ Arbitrer et exécuter immédiatement" : "Envoyer la proposition officielle"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};