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
import { logger } from '@/lib/logger';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAccountDialog = ({ open, onOpenChange }: DeleteAccountDialogProps) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  const handleDelete = async () => {
    if (!password) {
      toast.error(t('deleteAccount.passwordRequired'));
      return;
    }

    setIsValidating(true);

    try {
      // Validate password with current user's email
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error(t('deleteAccount.errorMessage'));
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (authError) {
        toast.error(t('deleteAccount.incorrectPassword'));
        setIsValidating(false);
        return;
      }
    } catch (error) {
      logger.error('Password validation error:', error);
      toast.error(t('deleteAccount.incorrectPassword'));
      setIsValidating(false);
      return;
    }

    setIsValidating(false);

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');

      // Always parse response data first, even if error is present
      const responseData = (data || error?.context || {}) as any;

      if (error || responseData?.error) {
        logger.error('Error deleting account:', { error, responseData });
        
        // Parse detailed error from backend
        const activeTransactionsCount = responseData?.activeTransactionsCount || 0;
        const activeDisputesCount = responseData?.activeDisputesCount || 0;
        const details = responseData?.details;

        if (activeTransactionsCount > 0 || activeDisputesCount > 0) {
          // Build detailed error message
          let detailedMessage = '';
          
          if (details?.pending > 0) {
            detailedMessage += t('deleteAccount.pendingTransactionsBlocking', { count: details.pending });
          }
          if (details?.paid > 0) {
            if (detailedMessage) detailedMessage += '\n';
            detailedMessage += t('deleteAccount.paidTransactionsBlocking', { count: details.paid });
          }
          if (activeDisputesCount > 0) {
            if (detailedMessage) detailedMessage += '\n';
            detailedMessage += t('deleteAccount.activeDisputesError', { count: activeDisputesCount });
          }

          // Show detailed toast with extended duration (8s)
          toast.error(
            t('deleteAccount.activeTransactionsError', { count: activeTransactionsCount + activeDisputesCount }),
            {
              description: detailedMessage + '\n\n' + t('deleteAccount.resolutionHelp'),
              duration: 8000,
            }
          );
        } else {
          // Fallback to generic error message
          const backendMessage = responseData?.error || responseData?.message;
          toast.error(backendMessage || error.message || t('deleteAccount.errorMessage'));
        }
        return;
      }

      toast.success(t('deleteAccount.successMessage'));

      // Close dialog and logout
      onOpenChange(false);
      await logout();
      
      // Redirect to home page
      window.location.href = '/';

    } catch (error) {
      logger.error('Unexpected error:', error);
      toast.error(t('deleteAccount.errorMessage'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting && !isValidating) {
      setPassword('');
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
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('deleteAccount.passwordPlaceholder')}
              disabled={isDeleting || isValidating}
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
            disabled={isDeleting || isValidating}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!password || isDeleting || isValidating}
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