import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEscalatedDisputeMessaging } from '../useEscalatedDisputeMessaging';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
const mockOrder = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOr = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      or: mockOr,
      order: mockOrder,
      single: mockSingle,
      insert: vi.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
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

describe('useEscalatedDisputeMessaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch transaction and determine seller role', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'test-user-id', buyer_id: 'other-user' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isRoleReady).toBe(true));

    expect(result.current.isSeller).toBe(true);
  });

  it('should fetch transaction and determine buyer role', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'other-user', buyer_id: 'test-user-id' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isRoleReady).toBe(true));

    expect(result.current.isSeller).toBe(false);
  });

  it('should fetch escalated messages', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        dispute_id: 'dispute-1',
        sender_id: 'test-user-id',
        message: 'Test message',
        created_at: new Date().toISOString(),
      },
    ];

    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'test-user-id', buyer_id: 'other-user' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: mockMessages,
      error: null,
    });

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual(mockMessages);
  });

  it('should send message with correct type for seller', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'test-user-id', buyer_id: 'other-user' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
    } as any);

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isRoleReady).toBe(true));

    await result.current.sendMessage({ message: 'Test message' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_type: 'seller_to_admin',
      })
    );
  });

  it('should send message with correct type for buyer', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'other-user', buyer_id: 'test-user-id' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'new-msg' }, error: null });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
    } as any);

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isRoleReady).toBe(true));

    await result.current.sendMessage({ message: 'Test message' });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_type: 'buyer_to_admin',
      })
    );
  });

  it('should handle send message errors', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'txn-1', user_id: 'test-user-id', buyer_id: 'other-user' },
      error: null,
    });

    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const mockInsert = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Failed to send'),
    });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
    } as any);

    const { result } = renderHook(
      () => useEscalatedDisputeMessaging({ disputeId: 'dispute-1', transactionId: 'txn-1' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isRoleReady).toBe(true));

    await expect(result.current.sendMessage({ message: 'Test' })).rejects.toThrow();
  });
});
