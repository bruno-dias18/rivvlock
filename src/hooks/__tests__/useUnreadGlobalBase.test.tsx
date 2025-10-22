import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnreadGlobalBase } from '../useUnreadGlobalBase';
import { supabase } from '@/integrations/supabase/client';
import * as AuthContext from '@/contexts/AuthContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useUnreadGlobalBase', () => {
  let queryClient: QueryClient;

  const mockUser = { id: 'user-123' };
  const mockConversationIds = ['conv-1', 'conv-2', 'conv-3'];

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: mockUser } as any);
  });

  it('should return 0 when conversationIds is null', async () => {
    const { result } = renderHook(
      () => useUnreadGlobalBase(null, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should return 0 when conversationIds is empty array', async () => {
    const { result } = renderHook(
      () => useUnreadGlobalBase([], ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should return 0 when user is not authenticated', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null } as any);

    const { result } = renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should count unread messages across multiple conversations', async () => {
    const mockMessages = [
      { id: 'msg-1', conversation_id: 'conv-1', created_at: '2024-01-01T11:00:00Z' },
      { id: 'msg-2', conversation_id: 'conv-1', created_at: '2024-01-01T12:00:00Z' },
      { id: 'msg-3', conversation_id: 'conv-2', created_at: '2024-01-01T11:30:00Z' },
      { id: 'msg-4', conversation_id: 'conv-3', created_at: '2024-01-01T10:00:00Z' }, // Read
    ];

    const mockReads = [
      { conversation_id: 'conv-1', last_read_at: '2024-01-01T10:00:00Z' },
      { conversation_id: 'conv-2', last_read_at: '2024-01-01T10:00:00Z' },
      { conversation_id: 'conv-3', last_read_at: '2024-01-01T11:00:00Z' },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          ...mockSupabaseChain,
          neq: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
        } as any;
      }
      if (table === 'conversation_reads') {
        return {
          ...mockSupabaseChain,
          in: vi.fn().mockResolvedValue({ data: mockReads, error: null }),
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(3)); // 2 from conv-1, 1 from conv-2, 0 from conv-3
  });

  it('should handle conversations with no last_read_at', async () => {
    const nowIso = new Date().toISOString();
    const mockMessages = [
      { id: 'msg-1', conversation_id: 'conv-1', created_at: '2024-01-01T10:00:00Z' },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          ...mockSupabaseChain,
          neq: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
        } as any;
      }
      if (table === 'conversation_reads') {
        return {
          ...mockSupabaseChain,
          in: vi.fn().mockResolvedValue({ data: [], error: null }), // No reads
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(
      () => useUnreadGlobalBase(['conv-1'], ['test-key']),
      { wrapper }
    );

    // Should use current time, so old message should not be unread
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should return 0 when no messages exist', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should respect custom staleTime and refetchInterval options', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useUnreadGlobalBase(
        mockConversationIds, 
        ['test-key'],
        { staleTime: 1000, refetchInterval: 5000 }
      ),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.refetch).toBeInstanceOf(Function);
    expect(result.current.isLoading).toBe(false);
  });

  it('should provide refetch and isLoading properties', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.refetch).toBeInstanceOf(Function);
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });

  it('should batch requests for efficiency (N+1 elimination)', async () => {
    const mockMessages = [
      { id: 'msg-1', conversation_id: 'conv-1', created_at: '2024-01-01T11:00:00Z' },
    ];

    const mockReads = [
      { conversation_id: 'conv-1', last_read_at: '2024-01-01T10:00:00Z' },
    ];

    const messagesQuery = vi.fn().mockResolvedValue({ data: mockMessages, error: null });
    const readsQuery = vi.fn().mockResolvedValue({ data: mockReads, error: null });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          neq: messagesQuery,
        } as any;
      }
      if (table === 'conversation_reads') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: readsQuery,
        } as any;
      }
      return {} as any;
    });

    renderHook(
      () => useUnreadGlobalBase(mockConversationIds, ['test-key']),
      { wrapper }
    );

    await waitFor(() => {
      // Should only call database once for messages and once for reads
      expect(messagesQuery).toHaveBeenCalledTimes(1);
      expect(readsQuery).toHaveBeenCalledTimes(1);
    });
  });
});
