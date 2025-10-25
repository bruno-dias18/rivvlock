import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';
import { logger } from '@/lib/logger';

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
      try {
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
      } catch (funcErr) {
        // Second fallback: direct client-side escalate for admins (RLS allows admins)
        logger.warn('useForceEscalateDispute - Fallback to direct update due to function error', funcErr);
        const { data: userRes } = await supabase.auth.getUser();
        const adminId = userRes?.user?.id;

        // Update dispute
        const { error: updErr } = await supabase
          .from('disputes')
          .update({ status: 'escalated', escalated_at: new Date().toISOString() })
          .eq('id', disputeId);
        if (updErr) throw updErr;

        // Best-effort: ensure escalated conversations
        if (adminId) {
          try {
            await supabase.rpc('create_escalated_dispute_conversations', {
              p_dispute_id: disputeId,
              p_admin_id: adminId,
            });
          } catch {}
        }

        return { success: true, message: 'Escalade effectuée (fallback client)' } as any;
      }
    },
    onSuccess: () => {
      toast.success('Litige escaladé avec succès');
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
    },
    onError: (error: any) => {
      // Attempt to extract precise server details from supabase-js error context
      const ctx = (error as any)?.context;
      const resp = ctx?.response;
      let statusCode = (error as any)?.status || (error as any)?.statusCode || resp?.status;
      let serverBody: any = ctx?.body;
      try {
        if (!serverBody && resp && typeof resp.text === 'function') {
          // best-effort: supabase-js may expose the raw Response
          // Note: cannot await here; keep fallback below
        }
      } catch {}
      const raw = typeof error === 'string' ? error : (error?.message || JSON.stringify(error));
      const code = (error as any)?.code;

      // Map common statuses to friendly messages
      let friendly = '';
      switch (statusCode) {
        case 422:
          friendly = 'Requête invalide: identifiant de litige non valide.';
          break;
        case 403:
          friendly = "Accès refusé: action réservée aux administrateurs.";
          break;
        case 404:
          friendly = 'Litige introuvable.';
          break;
        case 429:
          friendly = 'Trop de requêtes. Réessayez dans une minute.';
          break;
        default:
          friendly = 'Erreur lors de l’escalade du litige.';
      }

      const serverMsg = serverBody
        ? (typeof serverBody === 'string' ? serverBody : (serverBody.error || JSON.stringify(serverBody)))
        : '';

      logger.error('Force escalate failed', { error, statusCode, serverBody });
      import('sonner').then(({ toast }) => {
        toast.error('Erreur escalade', {
          description: `${friendly} ${serverMsg ? `- ${serverMsg}` : ''} ${raw ? `(${raw})` : ''}${statusCode ? ` (HTTP ${statusCode})` : ''}${code ? ` [${code}]` : ''}`.trim().slice(0, 400),
        });
      });
    }
  });
};
