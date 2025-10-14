import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHasTransactionMessages } from '../useHasTransactionMessages';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
const mockSingle = vi.fn();
const mockLimit = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      limit: mockLimit,
      single: mockSingle,
    })),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useHasTransactionMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when messages exist', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'msg-1' },
      error: null,
    });

    const { result } = renderHook(() => useHasTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('should return false when no messages exist', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' }, // No rows returned
    });

    const { result } = renderHook(() => useHasTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('should return false when transactionId is undefined', async () => {
    const { result } = renderHook(() => useHasTransactionMessages(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(false));

    // Should not call database
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'OTHER_ERROR', message: 'Database error' },
    });

    const { result } = renderHook(() => useHasTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('should query with correct transaction_id', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'msg-1' },
      error: null,
    });

    renderHook(() => useHasTransactionMessages('test-txn-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('transaction_id', 'test-txn-id');
    });
  });

  it('should only query for 1 message (limit)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'msg-1' },
      error: null,
    });

    renderHook(() => useHasTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockLimit).toHaveBeenCalledWith(1);
    });
  });

  it('should cache result with staleTime', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'msg-1' },
      error: null,
    });

    const { result, rerender } = renderHook(() => useHasTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toBe(true));

    // Rerender should use cache (not call DB again immediately)
    rerender();

    expect(result.current).toBe(true);
  });
});
