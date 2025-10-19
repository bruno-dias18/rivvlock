import { useDisputesUnified } from './useDisputesUnified';

/**
 * Fetches and manages disputes for the current user
 * 
 * Uses the unified messaging architecture (conversations + messages)
 * for optimal performance and consistency.
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
export const useDisputes = useDisputesUnified;