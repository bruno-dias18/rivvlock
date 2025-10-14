import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnreadDisputeMessages } from '../useUnreadDisputeMessages';
import type { Dispute } from '@/types';

// Simple waitFor implementation for tests
const waitFor = async (callback: () => void, options = { timeout: 1000 }) => {
  const startTime = Date.now();
  while (Date.now() - startTime < options.timeout) {
    try {
      callback();
      return;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  callback(); // Final attempt
};

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => 
            Promise.resolve({ data: null, error: null })
          ),
          neq: vi.fn(() => ({
            or: vi.fn(() => ({
              gt: vi.fn(() => 
                Promise.resolve({ count: 0, error: null })
              ),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useUnreadDisputeMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 unread count initially', () => {
    const { result } = renderHook(
      () => useUnreadDisputeMessages('test-dispute-id'),
      { wrapper: createWrapper() }
    );

    expect(result.current.unreadCount).toBe(0);
  });

  it('should return 0 for resolved disputes', async () => {
    const resolvedDispute: Dispute = {
      id: 'dispute-1',
      status: 'resolved_refund',
      reporter_id: 'test-user-id',
      transaction_id: 'transaction-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      reason: 'Test reason',
      dispute_type: 'quality_issue',
      archived_by_buyer: false,
      archived_by_seller: false,
      resolution: 'Refund issued',
      dispute_deadline: null,
      escalated_at: null,
      resolved_at: new Date().toISOString(),
      buyer_archived_at: null,
      seller_archived_at: null,
    };

    const { result } = renderHook(
      () => useUnreadDisputeMessages('dispute-1', resolvedDispute),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(
      () => useUnreadDisputeMessages('test-dispute-id'),
      { wrapper: createWrapper() }
    );

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should provide markAsSeen function (deprecated)', () => {
    const { result } = renderHook(
      () => useUnreadDisputeMessages('test-dispute-id'),
      { wrapper: createWrapper() }
    );

    expect(result.current.markAsSeen).toBeDefined();
    expect(typeof result.current.markAsSeen).toBe('function');
  });

  it('should not fetch if no user ID', () => {
    vi.mock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: null,
      }),
    }));

    const { result } = renderHook(
      () => useUnreadDisputeMessages('test-dispute-id'),
      { wrapper: createWrapper() }
    );

    expect(result.current.unreadCount).toBe(0);
  });

  it('should not fetch if no dispute ID', () => {
    const { result } = renderHook(
      () => useUnreadDisputeMessages(''),
      { wrapper: createWrapper() }
    );

    expect(result.current.unreadCount).toBe(0);
  });
});
