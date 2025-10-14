import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUnreadAdminMessages } from '../useUnreadAdminMessages';
import { supabase } from '@/integrations/supabase/client';

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
          or: vi.fn(() => 
            Promise.resolve({ data: [], error: null })
          ),
          gt: vi.fn(() => 
            Promise.resolve({ count: 0, error: null })
          ),
        })),
        or: vi.fn(() => 
          Promise.resolve({ data: [], error: null })
        ),
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

describe('useUnreadAdminMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should return 0 unread count initially', () => {
    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should provide refetch function', () => {
    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('should provide markAsSeen function (deprecated)', () => {
    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    expect(result.current.markAsSeen).toBeDefined();
    expect(typeof result.current.markAsSeen).toBe('function');
  });

  it('should call markAsSeen and update localStorage', () => {
    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    result.current.markAsSeen();

    const lastSeen = localStorage.getItem('last_seen_admin_messages');
    expect(lastSeen).toBeTruthy();
    expect(new Date(lastSeen!)).toBeInstanceOf(Date);
  });

  it('should not fetch if no user ID', () => {
    vi.mock('@/contexts/AuthContext', () => ({
      useAuth: () => ({
        user: null,
      }),
    }));

    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should filter out resolved disputes', async () => {
    const mockDisputes = [
      { id: '1', status: 'open', transaction_id: 'tx1' },
      { id: '2', status: 'resolved_refund', transaction_id: 'tx2' },
      { id: '3', status: 'responded', transaction_id: 'tx3' },
    ];

    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => 
          Promise.resolve({ data: [], error: null })
        ),
      })),
    } as any).mockReturnValueOnce({
      select: vi.fn(() => ({
        or: vi.fn(() => 
          Promise.resolve({ data: mockDisputes, error: null })
        ),
      })),
    } as any);

    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => 
          Promise.resolve({ data: null, error: { message: 'DB error' } })
        ),
      })),
    } as any);

    const { result } = renderHook(() => useUnreadAdminMessages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0);
    });
  });
});
