import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

export const useForceEscalateDispute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (disputeId: string) => {
      // Ensure Authorization header is always present
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

      // Try the dedicated robust function first
      const first = await supabase.functions.invoke('force-escalate-dispute', {
        body: { disputeId },
        headers: authHeaders,
      });
      console.debug('[useForceEscalateDispute] force-escalate-dispute result', { data: first.data, error: first.error, disputeId });
      if (!first.error) {
        if ((first.data as any)?.error) {
          const err: any = new Error((first.data as any).error);
          err.status = (first as any)?.status || (first.data as any)?.statusCode;
          throw err;
        }
        return first.data;
      }

      // Fallback to generic admin-dispute-actions escalate
      const fallback = await supabase.functions.invoke('admin-dispute-actions', {
        body: { action: 'escalate', disputeId },
        headers: authHeaders,
      });
      console.debug('[useForceEscalateDispute] admin-dispute-actions result', { data: fallback.data, error: fallback.error, disputeId });
      if (fallback.error) throw fallback.error;
      if ((fallback.data as any)?.error) {
        const err: any = new Error((fallback.data as any).error);
        err.status = (fallback as any)?.status || (fallback.data as any)?.statusCode;
        throw err;
      }
      return fallback.data;
    },
    onSuccess: () => {
      toast.success('Litige escaladé avec succès');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (error: any) => {
      // Show raw error details to the user to avoid generic messages
      const raw = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      console.error('Force escalate error details:', error);
      // Fallback to our friendly toast but include the raw message inline for visibility
      const statusCode = (error as any)?.status || (error as any)?.statusCode;
      const code = (error as any)?.code;
      import('sonner').then(({ toast }) => {
        toast.error('Erreur escalade', {
          description: `${raw}${statusCode ? ` (HTTP ${statusCode})` : ''}${code ? ` [${code}]` : ''}`.slice(0, 400),
        });
      });
    }
  });
};
