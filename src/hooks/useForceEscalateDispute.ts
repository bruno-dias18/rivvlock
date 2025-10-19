import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export const useForceEscalateDispute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (disputeId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-dispute-actions', {
        body: { action: 'escalate', disputeId }
      });
      console.debug('[useForceEscalateDispute] invoke result', { data, error, disputeId });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Litige escaladé avec succès');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (error: any) => {
      console.error('Force escalate error details:', error);
      const statusCode = (error as any)?.status || (error as any)?.statusCode;
      const code = (error as any)?.code;
      toast.error(error, { statusCode, code, details: error });
    }
  });
};
