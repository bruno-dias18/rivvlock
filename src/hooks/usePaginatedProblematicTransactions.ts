import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UsePaginatedProblematicTransactionsOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedProblematicTransactionsResult {
  transactions: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Hook for server-side paginated problematic transactions
 * Pattern: Identical to usePaginatedQuotes/usePaginatedTransactions
 * Problematic = transactions with status 'paid' but buyer_id NULL
 */
export function usePaginatedProblematicTransactions(options: UsePaginatedProblematicTransactionsOptions = {}) {
  const {
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  return useQuery({
    queryKey: ['problematic-transactions', 'paginated', page, pageSize, sortBy, sortOrder],
    queryFn: async (): Promise<PaginatedProblematicTransactionsResult> => {
      // Query for problematic transactions (paid but no buyer)
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' })
        .eq('status', 'paid')
        .is('buyer_id', null);

      // Apply sorting
      query = query.order(sortBy as any, { ascending: sortOrder === 'asc' });

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
        transactions: (data || []) as any[],
        totalCount,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
