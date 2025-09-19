import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, Users, RefreshCw } from 'lucide-react';

export const UserCleanup = () => {
  const [isLoading, setIsLoading] = useState(false);

  const cleanupOldUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('clean-old-users', {
        body: {}
      });

      if (error) {
        console.error('Error cleaning up users:', error);
        toast({
          title: "Erreur",
          description: "Impossible de nettoyer les anciens comptes utilisateurs.",
          variant: "destructive",
        });
        return;
      }

      const result = data;
      toast({
        title: "Nettoyage terminé",
        description: `${result.summary.successfulDeletions} comptes supprimés avec succès. ${result.summary.failedDeletions} échecs.`,
        variant: result.summary.failedDeletions > 0 ? "destructive" : "default",
      });

      console.log('Cleanup results:', result);
    } catch (error) {
      console.error('Exception during cleanup:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Users className="w-5 h-5" />
          Gestion des Utilisateurs
        </CardTitle>
        <CardDescription className="text-orange-700">
          Supprime tous les anciens comptes utilisateurs sauf l'administrateur principal (bruno-dias@outlook.com)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Nettoyage en cours...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Nettoyer les Anciens Comptes
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action va supprimer définitivement tous les comptes utilisateurs sauf l'administrateur principal (bruno-dias@outlook.com).
                <br /><br />
                <strong>Les comptes suivants seront supprimés :</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>jayjay@boubi.com</li>
                  <li>eloiseddias@gmail.com</li>
                  <li>elyes@csb.ch</li>
                  <li>damienbachtold@icloud.com</li>
                </ul>
                <br />
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={cleanupOldUsers}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmer la suppression
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};