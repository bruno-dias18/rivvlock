import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
      if (confirmText !== 'SUPPRIMER') {
        toast.error(t('deleteAccount.confirmTextError'));
        return;
      }

    setIsDeleting(true);

    try {
      const { error } = await supabase.functions.invoke('delete-user-account');

      if (error) {
        console.error('Error deleting account:', error);
        toast.error(error.message || t('deleteAccount.errorMessage'));
        return;
      }

      toast.success(t('deleteAccount.successMessage'));

      // Close dialog and logout
      onOpenChange(false);
      await logout();
      
      // Redirect to home page
      window.location.href = '/';

    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error(t('deleteAccount.errorMessage'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t('deleteAccount.title')}
          </DialogTitle>
          <DialogDescription>
            {t('deleteAccount.description')}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {t('deleteAccount.warning')}
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-text">
              {t('deleteAccount.confirmLabel')}
            </Label>
            <Input
              id="confirm-text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              disabled={isDeleting}
            />
            <p className="text-sm text-muted-foreground">
              {t('deleteAccount.confirmHelp')}
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">{t('deleteAccount.consequencesTitle')} :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('deleteAccount.consequence1')}</li>
              <li>{t('deleteAccount.consequence2')}</li>
              <li>{t('deleteAccount.consequence3')}</li>
              <li>{t('deleteAccount.consequence4')}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmText !== 'SUPPRIMER' || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('deleteAccount.deleting')}
              </>
            ) : (
              t('deleteAccount.confirmDelete')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};