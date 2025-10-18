/**
 * Dispute Migration Utilities
 * 
 * Phase 5: Tools for validating and monitoring the disputes migration
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "./logger";

/**
 * Validation results from database checks
 */
export interface ValidationResult {
  check: string;
  passed: boolean;
  count: number;
  expected: number;
  details?: string;
}

/**
 * Run all validation checks on dispute data integrity
 */
export async function validateDisputeIntegrity(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    // Check 1: All dispute conversations have a dispute_id
    const { count: missingDisputeId, error: error1 } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .in('conversation_type', ['admin_seller_dispute', 'admin_buyer_dispute'])
      .is('dispute_id', null);

    results.push({
      check: 'Dispute conversations with missing dispute_id',
      passed: missingDisputeId === 0,
      count: missingDisputeId || 0,
      expected: 0,
      details: error1?.message,
    });

    // Check 2: All disputes with conversation_id have valid conversations
    // Using client-side validation since RPC doesn't exist yet
    const { data: disputesWithConv, error: error2 } = await supabase
      .from('disputes')
      .select('id, conversation_id')
      .not('conversation_id', 'is', null);

    let orphanedCount = 0;
    if (disputesWithConv) {
      for (const dispute of disputesWithConv) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', dispute.conversation_id)
          .single();
        
        if (!conv) orphanedCount++;
      }
    }

    results.push({
      check: 'Disputes with invalid conversation_id',
      passed: orphanedCount === 0,
      count: orphanedCount,
      expected: 0,
      details: error2?.message,
    });

    // Check 3: conversation_id and dispute_id consistency
    // Using client-side validation
    const { data: conversationsWithDispute, error: error3 } = await supabase
      .from('conversations')
      .select('id, dispute_id')
      .not('dispute_id', 'is', null);

    let inconsistentCount = 0;
    if (conversationsWithDispute) {
      for (const conv of conversationsWithDispute) {
        const { data: dispute } = await supabase
          .from('disputes')
          .select('id, conversation_id')
          .eq('id', conv.dispute_id)
          .single();
        
        if (dispute && dispute.conversation_id !== conv.id) {
          inconsistentCount++;
        }
      }
    }

    results.push({
      check: 'Inconsistent dispute ↔ conversation links',
      passed: inconsistentCount === 0,
      count: inconsistentCount,
      expected: 0,
      details: error3?.message,
    });

    // Check 4: All active disputes have conversations
    const { count: disputesWithoutConv, error: error4 } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'responded', 'negotiating', 'escalated'])
      .is('conversation_id', null);

    results.push({
      check: 'Active disputes without conversations',
      passed: disputesWithoutConv === 0,
      count: disputesWithoutConv || 0,
      expected: 0,
      details: error4?.message,
    });

  } catch (error) {
    logger.error('Validation error', { error });
    results.push({
      check: 'Validation execution',
      passed: false,
      count: -1,
      expected: 0,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return results;
}

/**
 * Log validation results for monitoring
 */
export function logValidationResults(results: ValidationResult[]): void {
  const allPassed = results.every(r => r.passed);
  
  if (allPassed) {
    logger.info('✅ All dispute integrity checks passed', { results });
  } else {
    const failed = results.filter(r => !r.passed);
    logger.error('❌ Some dispute integrity checks failed', { 
      failed,
      allResults: results 
    });
  }
}

/**
 * Compare legacy and unified dispute data for double-running validation
 */
export interface DisputeComparison {
  disputeId: string;
  legacyData: any;
  unifiedData: any;
  mismatches: string[];
}

/**
 * Compare a dispute between legacy and unified systems
 */
export function compareDisputeData(
  legacyDispute: any,
  unifiedDispute: any
): DisputeComparison {
  const mismatches: string[] = [];

  // Compare key fields
  const fieldsToCompare = [
    'id',
    'transaction_id',
    'reporter_id',
    'status',
    'reason',
    'dispute_type',
    'created_at',
    'updated_at',
  ];

  for (const field of fieldsToCompare) {
    if (JSON.stringify(legacyDispute[field]) !== JSON.stringify(unifiedDispute[field])) {
      mismatches.push(`${field}: ${legacyDispute[field]} !== ${unifiedDispute[field]}`);
    }
  }

  return {
    disputeId: legacyDispute.id,
    legacyData: legacyDispute,
    unifiedData: unifiedDispute,
    mismatches,
  };
}

/**
 * Get statistics about disputes for monitoring
 */
export async function getDisputeStats() {
  try {
    // Get counts by status
    const { count: totalDisputes, error: error1 } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true });

    const { count: activeDisputes, error: error2 } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['open', 'responded', 'negotiating', 'escalated']);

    const { count: resolvedDisputes, error: error3 } = await supabase
      .from('disputes')
      .select('*', { count: 'exact', head: true })
      .in('status', ['resolved', 'resolved_refund', 'resolved_release']);

    if (error1 || error2 || error3) {
      throw new Error('Failed to fetch dispute stats');
    }

    return {
      total_disputes: totalDisputes || 0,
      active_disputes: activeDisputes || 0,
      resolved_disputes: resolvedDisputes || 0,
    };
  } catch (error) {
    logger.error('Failed to get dispute stats', { error });
    return {
      total_disputes: 0,
      active_disputes: 0,
      resolved_disputes: 0,
    };
  }
}

/**
 * Check if feature flags are correctly configured
 */
export function validateFeatureFlags(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Import dynamically to avoid circular dependencies
  import('./featureFlags').then(({ FEATURES }) => {
    // During preparation phase, both should be false
    results.push({
      check: 'UNIFIED_DISPUTES flag',
      passed: !FEATURES.UNIFIED_DISPUTES,
      count: FEATURES.UNIFIED_DISPUTES ? 1 : 0,
      expected: 0,
      details: 'Should be false during preparation phase',
    });

    results.push({
      check: 'DOUBLE_RUNNING flag',
      passed: FEATURES.DOUBLE_RUNNING === true,
      count: FEATURES.DOUBLE_RUNNING ? 1 : 0,
      expected: 1,
      details: 'Should be true for validation',
    });
  });

  return results;
}

/**
 * Create a detailed migration report
 */
export interface MigrationReport {
  timestamp: string;
  phase: string;
  validationResults: ValidationResult[];
  stats: any;
  recommendations: string[];
}

export async function generateMigrationReport(
  phase: string
): Promise<MigrationReport> {
  const validationResults = await validateDisputeIntegrity();
  const stats = await getDisputeStats();

  const recommendations: string[] = [];

  // Generate recommendations based on validation
  const failedChecks = validationResults.filter(r => !r.passed);
  if (failedChecks.length > 0) {
    recommendations.push(
      '⚠️ Some integrity checks failed - review and fix before proceeding'
    );
  }

  if (stats?.active_disputes > 50) {
    recommendations.push(
      '📊 High number of active disputes - consider migration during low-traffic period'
    );
  }

  return {
    timestamp: new Date().toISOString(),
    phase,
    validationResults,
    stats,
    recommendations,
  };
}
