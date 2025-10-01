import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProposal: (data: { proposalType: string; refundPercentage?: number; message?: string }) => Promise<void>;
  isCreating: boolean;
  transactionAmount: number;
  currency: string;
}

export const CreateProposalDialog: React.FC<CreateProposalDialogProps> = ({
  open,
  onOpenChange,
  onCreateProposal,
  isCreating,
  transactionAmount,
  currency,
}) => {
  const [selectedType, setSelectedType] = useState<string>('partial_refund');
  const [percentage, setPercentage] = useState<number>(50);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async () => {
    try {
      const proposalData = {
        proposalType: selectedType,
        refundPercentage: selectedType === 'partial_refund' ? percentage : selectedType === 'full_refund' ? 100 : 0,
        message: message.trim() || undefined,
      };

      await onCreateProposal(proposalData);
      toast.success('Proposition envoyée avec succès');
      onOpenChange(false);
      
      // Reset form
      setSelectedType('partial_refund');
      setPercentage(50);
      setMessage('');
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast.error('Erreur lors de l\'envoi de la proposition');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Faire une proposition officielle</DialogTitle>
          <DialogDescription>
            Proposez une solution de remboursement. L'autre partie pourra accepter ou refuser votre proposition.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Type de proposition</Label>
            
            <button
              onClick={() => setSelectedType('partial_refund')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedType === 'partial_refund'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">💰 Remboursement partiel</div>
              <div className="text-sm text-muted-foreground mt-1">
                Proposer un remboursement d'un certain pourcentage
              </div>
            </button>

            {selectedType === 'partial_refund' && (
              <div className="pl-4 space-y-3">
                <Label htmlFor="percentage">Pourcentage de remboursement</Label>
                <div className="flex items-center gap-4">
                  <input
                    id="percentage"
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={percentage}
                    onChange={(e) => setPercentage(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="font-medium text-lg w-20 text-right">{percentage}%</span>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="text-sm font-medium text-center">
                    {percentage}% = {((transactionAmount * percentage) / 100).toFixed(2)} {currency.toUpperCase()}
                  </div>
                  <div className="text-xs text-muted-foreground text-center mt-1">
                    Remboursement de {((transactionAmount * percentage) / 100).toFixed(2)} {currency.toUpperCase()} sur {transactionAmount.toFixed(2)} {currency.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedType('full_refund')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedType === 'full_refund'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">↩️ Remboursement complet</div>
              <div className="text-sm text-muted-foreground mt-1">
                Rembourser 100% du montant ({transactionAmount.toFixed(2)} {currency.toUpperCase()})
              </div>
            </button>

            <button
              onClick={() => setSelectedType('no_refund')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                selectedType === 'no_refund'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-medium">✋ Pas de remboursement</div>
              <div className="text-sm text-muted-foreground mt-1">
                Libération complète des fonds ({transactionAmount.toFixed(2)} {currency.toUpperCase()})
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message complémentaire (optionnel)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Expliquez votre proposition..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Envoi...' : 'Envoyer la proposition'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
