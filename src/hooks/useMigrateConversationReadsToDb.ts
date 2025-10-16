import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

/**
 * Hook de migration one-time: migrer localStorage conversation_seen_* vers conversation_reads
 * Exécuté une seule fois au démarrage de l'app
 */
export function useMigrateConversationReadsToDb() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const migrationKey = `conversation_reads_migrated_${user.id}`;
    
    // Vérifier si déjà migré
    if (localStorage.getItem(migrationKey)) {
      return;
    }

    const migrateLocalStorageToDb = async () => {
      try {
        const keysToMigrate: Array<{ conversationId: string; lastSeen: string }> = [];
        
        // Scanner localStorage pour les clés conversation_seen_*
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('conversation_seen_')) {
            const conversationId = key.replace('conversation_seen_', '');
            const lastSeen = localStorage.getItem(key);
            if (lastSeen && conversationId) {
              keysToMigrate.push({ conversationId, lastSeen });
            }
          }
        }

        if (keysToMigrate.length === 0) {
          localStorage.setItem(migrationKey, 'true');
          return;
        }

        logger.info(`Migrating ${keysToMigrate.length} conversation read statuses to DB`);

        // Upsert chaque entrée dans conversation_reads
        for (const { conversationId, lastSeen } of keysToMigrate) {
          await supabase
            .from('conversation_reads')
            .upsert({
              user_id: user.id,
              conversation_id: conversationId,
              last_read_at: lastSeen,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,conversation_id'
            });

          // Supprimer la clé localStorage après migration réussie
          localStorage.removeItem(`conversation_seen_${conversationId}`);
        }

        // Marquer comme migré
        localStorage.setItem(migrationKey, 'true');
        logger.info('Conversation reads migration completed');
      } catch (error) {
        logger.error('Failed to migrate conversation reads', { error: String(error) });
      }
    };

    migrateLocalStorageToDb();
  }, [user?.id]);
}
