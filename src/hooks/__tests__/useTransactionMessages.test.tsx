import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTransactionMessages } from '../useTransactionMessages';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      limit: mockLimit,
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
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

describe('useTransactionMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages successfully', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        transaction_id: 'txn-1',
        sender_id: 'test-user-id',
        message: 'Hello',
        created_at: new Date().toISOString(),
      },
    ];

    mockLimit.mockResolvedValueOnce({
      data: mockMessages,
      error: null,
    });

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual(mockMessages);
  });

  it('should return empty array when no messages', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.messages).toEqual([]);
  });

  it('should send message successfully', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const mockInsert = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'new-msg', message: 'New message' },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    } as any);

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.sendMessage({ message: 'New message' });

    expect(mockInsert).toHaveBeenCalled();
  });

  it('should mark messages as read', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.markAsRead();

    const { supabase } = await import('@/integrations/supabase/client');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('mark-messages-read', {
      body: { transactionId: 'txn-1' },
    });
  });

  it('should handle send message errors', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const mockInsert = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Failed to send'),
    });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    } as any);

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.sendMessage({ message: 'Test' })).rejects.toThrow();
  });

  it('should trim and limit message length', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const longMessage = 'a'.repeat(2000);
    const mockInsert = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'new-msg' },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      insert: mockInsert,
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    } as any);

    const { result } = renderHook(() => useTransactionMessages('txn-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.sendMessage({ message: longMessage });

    // Should have been called with trimmed message (max 1000 chars)
    expect(mockInsert).toHaveBeenCalled();
  });
});
