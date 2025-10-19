/**
 * Feature Flags
 * 
 * ✅ PHASE 5 COMPLETE: Disputes Migration to Unified Architecture
 * 
 * The unified messaging system is now the permanent architecture.
 * All disputes use conversations + messages for optimal performance.
 * 
 * Migration completed and legacy system removed.
 */

export const FEATURES = {
  /**
   * Unified dispute architecture (PERMANENT)
   * 
   * ✅ Migration completed - This is now the only system
   * 
   * Benefits:
   * - Single messaging architecture for all conversations
   * - Reduced API requests and improved caching
   * - Consistent UX across transaction and dispute messages
   */
  UNIFIED_DISPUTES: true,
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
