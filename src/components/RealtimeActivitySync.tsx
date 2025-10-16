import { useRealtimeActivityRefresh } from '@/hooks/useRealtimeActivityRefresh';
import { useMigrateConversationReadsToDb } from '@/hooks/useMigrateConversationReadsToDb';

/**
 * Composant wrapper pour activer le rafraîchissement automatique en temps réel
 * + migration one-time localStorage -> conversation_reads DB
 * N'affiche rien, juste active les hooks pour toute l'application
 */
export const RealtimeActivitySync = () => {
  useRealtimeActivityRefresh();
  useMigrateConversationReadsToDb();
  return null;
};
