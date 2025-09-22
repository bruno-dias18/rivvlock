import { useState } from 'react';
import { AlertTriangle, Flag, FileText, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  userRole: 'seller' | 'buyer';
  onDisputeCreated: () => void;
}

export const DisputeModal = ({ isOpen, onClose, transactionId, userRole, onDisputeCreated }: DisputeModalProps) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const isSeller = userRole === 'seller';
  const title = isSeller ? 'Ouvrir un Litige' : 'Signaler un Litige';
  const Icon = isSeller ? AlertTriangle : Flag;
  const buttonText = isSeller ? 'Ouvrir le litige' : 'Signaler le litige';
  const description_placeholder = isSeller 
    ? 'Décrivez le problème rencontré (paiement non reçu, service non conforme aux attentes, etc.)'
    : 'Décrivez le problème rencontré (service non livré, non conforme à la description, etc.)';

  const handleSubmitDispute = async () => {
    if (!description.trim() || !user) return;

    setIsSubmitting(true);
    try {
      // Check if a dispute already exists
      const { data: existingDispute } = await supabase
        .from('disputes')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

      if (existingDispute) {
        toast({
          variant: 'destructive',
          title: 'Litige déjà existant',
          description: 'Un litige existe déjà pour cette transaction.',
        });
        return;
      }

      const { data: dispute, error } = await supabase
        .from('disputes')
        .insert({
          transaction_id: transactionId,
          reporter_id: user.id,
          description: description.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update transaction with dispute reference
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ dispute_id: dispute.id })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Error updating transaction with dispute:', updateError);
      }

      // Send notifications
      await supabase.functions.invoke('send-notifications', {
        body: {
          type: 'dispute_created',
          transactionId: transactionId,
          message: `Un litige a été ${isSeller ? 'ouvert' : 'signalé'} par ${isSeller ? 'le vendeur' : 'l\'acheteur'}`,
          recipients: ['admin', 'seller', 'buyer']
        }
      });

      toast({
        title: 'Litige créé',
        description: 'Votre litige a été soumis à l\'équipe d\'arbitrage. Vous recevrez une réponse sous 48h.',
      });

      setDescription('');
      onClose();
      onDisputeCreated();
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le litige.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isSeller ? 'bg-orange-100' : 'bg-red-100'}`}>
              <Icon className={`w-5 h-5 ${isSeller ? 'text-orange-600' : 'text-red-600'}`} />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription>
            {isSeller 
              ? 'Décrivez le problème rencontré avec cette transaction en tant que vendeur'
              : 'Signalez un problème avec cette transaction en tant qu\'acheteur'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>Important :</strong> Un litige sera examiné par notre équipe d'arbitrage. 
              Soyez précis et factuel dans votre description.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Description du problème *
            </label>
            <Textarea
              placeholder={description_placeholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 20 caractères ({description.length}/20)
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 mb-3">Processus d'arbitrage :</h4>
            <ul className="text-sm text-amber-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Examen du litige sous 48h par notre équipe
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Investigation avec les deux parties
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Décision : remboursement acheteur ou libération vendeur
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                Frais de plateforme (5%) conservés dans tous les cas
              </li>
            </ul>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button
              onClick={handleSubmitDispute}
              disabled={description.trim().length < 20 || isSubmitting}
              className="flex-1"
              variant={isSeller ? "default" : "destructive"}
            >
              {isSubmitting ? (
                'Soumission...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {buttonText}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};