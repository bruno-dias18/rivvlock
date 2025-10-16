import { useRealtimeActivityRefresh } from '@/hooks/useRealtimeActivityRefresh';

/**
 * Composant wrapper pour activer le rafraîchissement automatique en temps réel
 * N'affiche rien, juste active le hook pour toute l'application
 */
export const RealtimeActivitySync = () => {
  useRealtimeActivityRefresh();
  return null;
};
