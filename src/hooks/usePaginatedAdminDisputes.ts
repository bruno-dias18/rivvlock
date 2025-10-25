import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Dispute } from '@/types';

export interface UsePaginatedAdminDisputesOptions {
  page?: number;
  pageSize?: number;
  statusFilter?: string;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

interface DisputeWithTransaction {
  id: string;
  transaction_id: string;
  dispute_type: string;
  reason: string;
  status: string;
  resolution: string | null;
  dispute_deadline: string | null;
  escalated_at: string | null;
  resolved_at: string | null;
  archived_by_seller: boolean;
  archived_by_buyer: boolean;
  created_at: string;
  updated_at: string;
  transactions: {
    id: string;
    title: string;
    price: number;
    currency: string;
    user_id: string;
    buyer_id: string | null;
    status: string;
  };
}

export interface PaginatedAdminDisputesResult {
  disputes: DisputeWithTransaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Hook for server-side paginated admin disputes
 * Pattern: Identical to usePaginatedQuotes/usePaginatedTransactions
 */
export function usePaginatedAdminDisputes(options: UsePaginatedAdminDisputesOptions = {}) {
  const { user } = useAuth();
  const {
    page = 1,
    pageSize = 20,
    statusFilter = 'all',
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  return useQuery({
    queryKey: ['admin-disputes', 'paginated', page, pageSize, statusFilter, sortBy, sortOrder],
    queryFn: async (): Promise<PaginatedAdminDisputesResult> => {
      // Base query with transaction data
      let query = supabase
        .from('disputes')
        .select(`
          *,
          transactions!inner(
            id,
            title,
            price,
            currency,
            user_id,
            buyer_id,
            status
          )
        `, { count: 'exact' });

      // Apply status filters
      if (statusFilter === 'recent') {
        // Recent = created in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      } else if (statusFilter !== 'all') {
        // Map filter to actual statuses
        if (statusFilter === 'resolved') {
          query = query.or('status.eq.resolved,status.eq.resolved_refund,status.eq.resolved_release');
        } else {
          // Safe cast since statusFilter is validated
          query = query.eq('status', statusFilter as 'open' | 'negotiating' | 'escalated' | 'responded');
        }
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        disputes: (data || []) as DisputeWithTransaction[],
        totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
