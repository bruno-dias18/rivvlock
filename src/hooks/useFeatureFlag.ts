/**
 * ✅ FEATURE FLAGS HOOK
 * 
 * Hook pour activer/désactiver des features sans redeploy.
 * Les flags sont stockés en base de données (table feature_flags).
 * 
 * @example
 * ```tsx
 * const { enabled, isLoading } = useFeatureFlag('beta_payment_flow');
 * 
 * if (enabled) {
 *   return <NewPaymentFlow />;
 * }
 * return <OldPaymentFlow />;
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface FeatureFlag {
  feature_key: string;
  enabled: boolean;
  rollout_percentage: number;
  description?: string;
}

interface UseFeatureFlagResult {
  enabled: boolean;
  isLoading: boolean;
  error: Error | null;
  flag: FeatureFlag | null;
}

/**
 * Hook pour vérifier si une feature flag est activée
 * 
 * @param featureKey - Clé unique de la feature (ex: 'beta_payment_flow')
 * @returns Object avec enabled, isLoading, error, flag
 */
export function useFeatureFlag(featureKey: string): UseFeatureFlagResult {
  const { data: flag, isLoading, error } = useQuery({
    queryKey: ['feature-flag', featureKey],
    queryFn: async () => {
      logger.debug('[useFeatureFlag] Checking flag', { featureKey });

      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('feature_key', featureKey)
        .maybeSingle();

      if (error) {
        // Si la flag n'existe pas, on considère qu'elle est désactivée
        if (error.code === 'PGRST116') {
          logger.debug('[useFeatureFlag] Flag not found, returning disabled', { featureKey });
          return null;
        }
        throw error;
      }

      logger.debug('[useFeatureFlag] Flag found', { 
        featureKey, 
        enabled: data.enabled,
        rollout: data.rollout_percentage 
      });

      return data as FeatureFlag;
    },
    // Cache pendant 5 minutes (les flags changent rarement)
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Ne pas retry si la flag n'existe pas
    retry: (failureCount, error: any) => {
      if (error?.code === 'PGRST116') return false;
      return failureCount < 2;
    },
  });

  // Si pas de flag en base, on considère que c'est désactivé
  const enabled = flag?.enabled ?? false;

  return {
    enabled,
    isLoading,
    error: error as Error | null,
    flag,
  };
}

/**
 * Hook pour vérifier si une feature flag est activée (version simple)
 * Retourne directement le boolean
 * 
 * @param featureKey - Clé unique de la feature
 * @returns true si activée, false sinon
 */
export function useIsFeatureEnabled(featureKey: string): boolean {
  const { enabled } = useFeatureFlag(featureKey);
  return enabled;
}
