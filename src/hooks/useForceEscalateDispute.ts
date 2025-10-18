import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export const useForceEscalateDispute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (disputeId: string) => {
      const { data, error } = await supabase.functions.invoke('force-escalate-dispute', {
        body: { disputeId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Litige escaladé avec succès');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (error: any) => {
      console.error('Force escalate error:', error);
      toast.error(error.message || 'Une erreur inattendue est survenue');
    }
  });
};
