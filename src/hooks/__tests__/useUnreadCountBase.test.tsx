import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnreadCountBase } from '../useUnreadCountBase';
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

describe('useUnreadCountBase', () => {
  let queryClient: QueryClient;

  const mockUser = { id: 'user-123' };
  const mockConversationId = 'conv-456';

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

  it('should return 0 when conversationId is null', async () => {
    const { result } = renderHook(
      () => useUnreadCountBase(null, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should return 0 when user is not authenticated', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null } as any);

    const { result } = renderHook(
      () => useUnreadCountBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should count unread messages correctly', async () => {
    const mockRead = { last_read_at: '2024-01-01T10:00:00Z' };
    const mockMessages = [
      { id: 'msg-1', created_at: '2024-01-01T10:30:00Z' }, // Unread
      { id: 'msg-2', created_at: '2024-01-01T11:00:00Z' }, // Unread
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockRead, error: null }),
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'conversation_reads') {
        return mockSupabaseChain as any;
      }
      if (table === 'messages') {
        return {
          ...mockSupabaseChain,
          gt: vi.fn().mockResolvedValue({ count: 2, error: null }),
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(
      () => useUnreadCountBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(2));
  });

  it('should use 1970 as default when no last_read_at exists', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'conversation_reads') {
        return mockSupabaseChain as any;
      }
      if (table === 'messages') {
        return {
          ...mockSupabaseChain,
          gt: vi.fn().mockImplementation((field, value) => {
            expect(value).toBe('1970-01-01T00:00:00Z');
            return Promise.resolve({ count: 5, error: null });
          }),
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(
      () => useUnreadCountBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(5));
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'messages') {
        return {
          ...mockSupabaseChain,
          gt: vi.fn().mockResolvedValue({ 
            count: null, 
            error: new Error('Database error') 
          }),
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(
      () => useUnreadCountBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('should provide refetch function', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      return {
        ...mockSupabaseChain,
        gt: vi.fn().mockResolvedValue({ count: 3, error: null }),
      } as any;
    });

    const { result } = renderHook(
      () => useUnreadCountBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.unreadCount).toBe(3));
    expect(result.current.refetch).toBeInstanceOf(Function);
  });
});
