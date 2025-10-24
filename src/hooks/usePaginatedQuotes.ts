import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Quote } from '@/types/quotes';

export interface UsePaginatedQuotesOptions {
  page?: number;
  pageSize?: number;
  type?: 'sent' | 'received'; // sent = seller, received = client
  sortBy?: 'created_at' | 'updated_at' | 'valid_until';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedQuotesResult {
  quotes: Quote[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Hook for server-side paginated quotes
 * Pattern: Identical to usePaginatedTransactions for consistency
 */
export function usePaginatedQuotes(options: UsePaginatedQuotesOptions = {}) {
  const { user } = useAuth();
  const {
    page = 1,
    pageSize = 20,
    type = 'sent',
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  return useQuery({
    queryKey: ['quotes', 'paginated', page, pageSize, type, sortBy, sortOrder, user?.id],
    queryFn: async (): Promise<PaginatedQuotesResult> => {
      if (!user?.id) {
        return {
          quotes: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: page,
          hasNextPage: false,
          hasPreviousPage: false,
        };
      }

      // Build query based on type
      let query = supabase
        .from('quotes')
        .select('*', { count: 'exact' });

      // Filter by type
      if (type === 'sent') {
        query = query.eq('seller_id', user.id);
      } else {
        query = query.eq('client_user_id', user.id);
      }

      // Exclude archived quotes
      if (type === 'sent') {
        query = query.eq('archived_by_seller', false);
      } else {
        query = query.eq('archived_by_client', false);
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
        quotes: (data || []) as unknown as Quote[],
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
