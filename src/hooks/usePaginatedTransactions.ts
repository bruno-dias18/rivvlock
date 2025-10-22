import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Transaction } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

const ITEMS_PER_PAGE = 20;

interface UsePaginatedTransactionsOptions {
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'paid' | 'validated' | 'disputed' | 'expired' | 'all';
  sortBy?: 'created_at' | 'updated_at' | 'price';
  sortOrder?: 'asc' | 'desc';
}

interface PaginatedResult {
  transactions: Transaction[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Hook for paginated transactions with server-side pagination
 * 
 * Features:
 * - Server-side pagination (reduces memory usage)
 * - Total count tracking
 * - Status filtering
 * - Sorting options
 * - Automatic cache invalidation
 * 
 * @example
 * const { data, isLoading } = usePaginatedTransactions({ 
 *   page: 1, 
 *   status: 'paid' 
 * });
 */
export function usePaginatedTransactions(
  options: UsePaginatedTransactionsOptions = {}
) {
  const { user } = useAuth();
  const {
    page = 1,
    pageSize = ITEMS_PER_PAGE,
    status,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  return useQuery({
    queryKey: ['transactions-paginated', user?.id, page, pageSize, status, sortBy, sortOrder],
    queryFn: async (): Promise<PaginatedResult> => {
      if (!user?.id) {
        return {
          transactions: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          hasNextPage: false,
          hasPreviousPage: false,
        };
      }

      // Calculate offset for pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Build query
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .or(`user_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to);

      // Apply status filter if provided (côté serveur)
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching paginated transactions:', error);
        throw error;
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        transactions: (data || []) as unknown as Transaction[],
        totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
