import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, FileText } from 'lucide-react';
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
        },
      });

      if (error) throw error;

      toast.success("Proposition officielle envoyée aux deux parties");
      onOpenChange(false);
      setMessage('');
      setRefundPercentage(50);
      setProposalType('partial_refund');
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Créer une proposition officielle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-900 dark:text-purple-100">
                <p className="font-medium mb-1">Proposition administrative officielle</p>
                <p>
                  Cette proposition sera envoyée aux deux parties (acheteur et vendeur) qui devront
                  <strong> tous les deux valider</strong> pour que la solution soit appliquée automatiquement.
                </p>
                <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
                  ⏱️ Les parties auront 48 heures pour répondre.
                </p>
              </div>
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
              <p className="text-xs text-muted-foreground">
                L'acheteur sera remboursé de {refundPercentage}% et le vendeur recevra {100 - refundPercentage}%.
                Les frais Rivvlock (5%) seront partagés proportionnellement.
              </p>
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

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Envoi en cours..." : "Envoyer la proposition officielle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
