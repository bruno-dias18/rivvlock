/**
 * Feature Flags for Progressive Rollout
 * 
 * PHASE 5: Disputes Migration to Unified Architecture
 * 
 * Usage:
 * - UNIFIED_DISPUTES: Toggle between legacy and unified dispute system
 * - DOUBLE_RUNNING: Run both systems in parallel for validation
 */

export const FEATURES = {
  /**
   * Enable unified dispute architecture
   * 
   * @default false - Use legacy dispute system
   * 
   * Rollout plan:
   * - Week 1: false (Preparation)
   * - Week 2: false (Data migration)
   * - Week 3: false (Code implementation)
   * - Week 4 Day 1: true (Admin only - Alpha)
   * - Week 4 Day 3: true (10% users - Beta)
   * - Week 4 Day 5: true (100% users - Production)
   */
  UNIFIED_DISPUTES: false,

  /**
   * Enable double-running mode for validation
   * Runs both legacy and unified systems in parallel
   * Logs mismatches for debugging
   * 
   * @default true during migration, false after
   * 
   * Performance impact: ~20% additional queries
   * Only active when UNIFIED_DISPUTES is true
   */
  DOUBLE_RUNNING: true,
} as const;

export type FeatureFlags = typeof FEATURES;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return FEATURES[feature];
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): Array<keyof FeatureFlags> {
  return (Object.keys(FEATURES) as Array<keyof FeatureFlags>).filter(
    (key) => FEATURES[key]
  );
}
