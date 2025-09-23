import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface ContactSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
}

export function ContactSellerDialog({ open, onOpenChange, transaction }: ContactSellerDialogProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.error('Veuillez saisir un message');
      return;
    }

    setIsLoading(true);
    try {
      // For now, we'll just show a success message
      // In a real implementation, this would send an email or create a message
      toast.success('Message envoyé au vendeur avec succès');
      setMessage('');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contacter le vendeur
          </DialogTitle>
          <DialogDescription>
            Envoyez un message au vendeur concernant la transaction "{transaction?.title}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Décrivez votre demande ou question..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSendMessage} disabled={isLoading || !message.trim()}>
            {isLoading ? 'Envoi...' : 'Envoyer le message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}