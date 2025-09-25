import { useState, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/copyUtils';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  transactionTitle: string;
}

export function ShareLinkDialog({ open, onOpenChange, shareLink, transactionTitle }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCopyLink = async () => {
    try {
      const result = await copyToClipboard(shareLink, { 
        inputRef, 
        fallbackToPrompt: true 
      });
      
      if (result.success) {
        setCopied(true);
        
        if (result.method === 'prompt') {
          toast.success('Lien prêt à copier ! Utilisez Ctrl+C ou Cmd+C');
        } else {
          toast.success('Lien copié dans le presse-papier !');
        }
        
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error(result.error || 'Échec de la copie');
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      
      // Fallback: select text for manual copy
      if (inputRef.current) {
        inputRef.current.select();
        inputRef.current.setSelectionRange(0, shareLink.length);
      }
      
      toast.error('Impossible de copier automatiquement. Le texte a été sélectionné pour vous.');
    }
  };

  const handleClose = () => {
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transaction créée avec succès !</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">"{transactionTitle}"</h3>
            <p className="text-muted-foreground text-sm">
              Partagez ce lien avec le client pour qu'il puisse procéder au paiement
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Lien de paiement</label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={shareLink}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0"
                variant={copied ? "default" : "outline"}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copier
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Comment ça marche ?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Le client clique sur le lien</li>
              <li>• Il se connecte ou crée un compte RivvLock</li>
              <li>• Il procède au paiement via Stripe</li>
              <li>• Vous recevez une notification de paiement</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}