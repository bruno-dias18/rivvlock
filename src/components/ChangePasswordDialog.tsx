import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Le mot de passe actuel est requis'),
  newPassword: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(1, 'La confirmation est requise'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const { user } = useAuth();

  const form = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      // First, try to sign in with current password to verify it
      const { data: user } = await supabase.auth.getUser();
      if (!user.user?.email) {
        toast.error('Utilisateur non trouvé');
        return;
      }

      // Sign in to verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.user.email,
        password: data.currentPassword,
      });

      if (signInError) {
        toast.error('Mot de passe actuel incorrect');
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword
      });

      if (updateError) {
        toast.error('Erreur lors de la mise à jour du mot de passe');
        console.error('Password update error:', updateError);
        return;
      }

      toast.success('Mot de passe mis à jour avec succès');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setIsResetMode(false);
    onOpenChange(false);
  };

  const handleForgotPassword = async () => {
    if (!user?.email) {
      toast.error('Email utilisateur non trouvé');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) {
        toast.error('Erreur lors de l\'envoi de l\'email');
        console.error('Password reset error:', error);
        return;
      }

      toast.success('Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.');
      onOpenChange(false);
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>
            {isResetMode ? 'Mot de passe oublié' : 'Modifier le mot de passe'}
          </DialogTitle>
        </DialogHeader>

        {isResetMode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Un email de réinitialisation sera envoyé à votre adresse : <strong>{user?.email}</strong>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsResetMode(false)}
                disabled={isLoading}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                onClick={handleForgotPassword}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Envoi...' : 'Envoyer l\'email'}
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe actuel</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Votre mot de passe actuel"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Votre nouveau mot de passe"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le nouveau mot de passe</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirmer le nouveau mot de passe"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm text-primary hover:text-primary/90 underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}