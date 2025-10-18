import { useEffect } from 'react';
import { useDisputesLegacy } from './useDisputesLegacy';
import { useDisputesUnified } from './useDisputesUnified';
import { FEATURES } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { compareDisputeData } from '@/lib/disputeMigrationUtils';

/**
 * Fetches and manages disputes for the current user
 * 
 * Phase 5: Adaptive hook that uses feature flags to switch between:
 * - Legacy disputes system (direct queries)
 * - Unified disputes system (conversation-based)
 * 
 * When DOUBLE_RUNNING is enabled, both systems run in parallel for validation.
 * 
 * @returns {UseQueryResult<Dispute[]>} Query result with disputes array
 * 
 * @example
 * ```tsx
 * const { data: disputes, isLoading, refetch } = useDisputes();
 * 
 * if (isLoading) return <SkeletonLayouts.DisputeCard />;
 * if (!disputes?.length) return <EmptyStates.NoDisputes />;
 * 
 * return disputes.map(dispute => (
 *   <DisputeCard key={dispute.id} dispute={dispute} />
 * ));
 * ```
 */
export const useDisputes = () => {
  // Fetch from both systems if double-running is enabled
  const legacyQuery = useDisputesLegacy();
  const unifiedQuery = useDisputesUnified();

  // Choose which system to use based on feature flags
  const activeQuery = FEATURES.UNIFIED_DISPUTES ? unifiedQuery : legacyQuery;

  // Double-running validation: Compare results from both systems
  useEffect(() => {
    if (!FEATURES.DOUBLE_RUNNING || !FEATURES.UNIFIED_DISPUTES) return;
    if (!legacyQuery.data || !unifiedQuery.data) return;

    const legacyDisputes = legacyQuery.data;
    const unifiedDisputes = unifiedQuery.data;

    // Compare counts
    if (legacyDisputes.length !== unifiedDisputes.length) {
      logger.error('DISPUTE_MISMATCH: Count difference', {
        legacy: legacyDisputes.length,
        unified: unifiedDisputes.length,
      });
    }

    // Compare individual disputes
    const legacyMap = new Map(legacyDisputes.map(d => [d.id, d]));
    const unifiedMap = new Map(unifiedDisputes.map(d => [d.id, d]));

    // Check for missing disputes in unified
    legacyDisputes.forEach((legacyDispute) => {
      const unifiedDispute = unifiedMap.get(legacyDispute.id);
      if (!unifiedDispute) {
        logger.error('DISPUTE_MISMATCH: Missing in unified', {
          disputeId: legacyDispute.id,
        });
        return;
      }

      // Deep comparison
      const comparison = compareDisputeData(legacyDispute, unifiedDispute);
      if (comparison.mismatches.length > 0) {
        logger.error('DISPUTE_MISMATCH: Data difference', {
          disputeId: legacyDispute.id,
          mismatches: comparison.mismatches,
        });
      }
    });

    // Check for extra disputes in unified
    unifiedDisputes.forEach((unifiedDispute) => {
      if (!legacyMap.has(unifiedDispute.id)) {
        logger.error('DISPUTE_MISMATCH: Extra in unified', {
          disputeId: unifiedDispute.id,
        });
      }
    });

    // Log success if no mismatches
    if (legacyDisputes.length === unifiedDisputes.length) {
      logger.info('DISPUTE_DOUBLE_RUNNING: No mismatches detected', {
        count: legacyDisputes.length,
      });
    }
  }, [legacyQuery.data, unifiedQuery.data]);

  // Return the active query result
  return activeQuery;
};