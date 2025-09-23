import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CreateDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onDisputeCreated?: () => void;
}

export function CreateDisputeDialog({ open, onOpenChange, transaction, onDisputeCreated }: CreateDisputeDialogProps) {
  const { t } = useTranslation();
  const [disputeType, setDisputeType] = useState('quality_issue');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const disputeTypes = [
    { value: 'quality_issue', label: 'Problème de qualité' },
    { value: 'not_received', label: 'Service non reçu' },
    { value: 'not_as_described', label: 'Non conforme à la description' },
    { value: 'fraud', label: 'Fraude suspectée' },
    { value: 'other', label: 'Autre' },
  ];

  const handleCreateDispute = async () => {
    if (!reason.trim()) {
      toast.error('Veuillez décrire la raison du litige');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-dispute', {
        body: {
          transactionId: transaction.id,
          disputeType,
          reason: reason.trim(),
        },
      });

      if (error) {
        throw error;
      }

      toast.success('Litige créé avec succès. Un administrateur va examiner votre demande.');
      setReason('');
      setDisputeType('quality_issue');
      onOpenChange(false);
      onDisputeCreated?.();
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast.error('Erreur lors de la création du litige');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Ouvrir un litige
          </DialogTitle>
          <DialogDescription>
            Signaler un problème avec la transaction "{transaction?.title}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="dispute-type">Type de problème</Label>
            <Select value={disputeType} onValueChange={setDisputeType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez le type de problème" />
              </SelectTrigger>
              <SelectContent>
                {disputeTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="reason">Description détaillée</Label>
            <Textarea
              id="reason"
              placeholder="Décrivez précisément le problème rencontré..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCreateDispute} 
            disabled={isLoading || !reason.trim()}
          >
            {isLoading ? 'Création...' : 'Créer le litige'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}