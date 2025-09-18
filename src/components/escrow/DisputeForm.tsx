import { useState } from 'react';
import { AlertTriangle, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DisputeFormProps {
  transactionId: string;
  onDisputeCreated: () => void;
}

export const DisputeForm = ({ transactionId, onDisputeCreated }: DisputeFormProps) => {
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmitDispute = async () => {
    if (!description.trim() || !user) return;

    setIsSubmitting(true);
    try {
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
          message: 'Un litige a été créé pour cette transaction',
          recipients: ['admin', 'seller', 'buyer']
        }
      });

      toast({
        title: 'Litige créé',
        description: 'Votre litige a été soumis à l\'équipe d\'arbitrage. Vous recevrez une réponse sous 48h.',
      });

      setShowForm(false);
      setDescription('');
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

  if (!showForm) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
            <div>
              <h3 className="font-semibold text-red-800">Il y a un problème ?</h3>
              <p className="text-sm text-red-600 mt-1">
                Si le service n'a pas été rendu correctement, vous pouvez ouvrir un litige.
              </p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              variant="destructive"
              className="w-full"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Ouvrir un litige
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200">
      <CardHeader className="bg-red-50">
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="w-5 h-5" />
          Créer un litige
        </CardTitle>
        <CardDescription className="text-red-600">
          Décrivez le problème rencontré avec cette transaction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Important :</strong> Un litige sera examiné par notre équipe d'arbitrage. 
            Soyez précis et factuel dans votre description.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Description du problème *
          </label>
          <Textarea
            placeholder="Décrivez en détail le problème rencontré (service non conforme, non livré, etc.)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Minimum 20 caractères ({description.length}/20)
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-medium text-amber-800 mb-2">Processus d'arbitrage :</h4>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• Examen du litige sous 48h</li>
            <li>• Investigation avec les deux parties</li>
            <li>• Décision : remboursement acheteur ou libération vendeur</li>
            <li>• Frais de 5% conservés par la plateforme</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => setShowForm(false)}
            variant="outline"
            className="flex-1"
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmitDispute}
            disabled={description.trim().length < 20 || isSubmitting}
            className="flex-1"
            variant="destructive"
          >
            {isSubmitting ? (
              'Soumission...'
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Soumettre le litige
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};