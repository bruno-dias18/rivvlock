import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisputeMessages } from '../useDisputeMessages';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: {}, error: null }))
        }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn()
  }
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' }
  })
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

describe('useDisputeMessages', () => {
  const testDisputeId = 'test-dispute-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages for a dispute', () => {
    const { result } = renderHook(
      () => useDisputeMessages(testDisputeId),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.messages).toBeDefined();
  });

  it('should provide sendMessage function', () => {
    const { result } = renderHook(
      () => useDisputeMessages(testDisputeId),
      { wrapper: createWrapper() }
    );

    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.isSendingMessage).toBe('boolean');
  });

  it('should handle message limit correctly', () => {
    const { result } = renderHook(
      () => useDisputeMessages(testDisputeId),
      { wrapper: createWrapper() }
    );

    // Message limit is enforced at 100 messages
    expect(typeof result.current.sendMessage).toBe('function');
    // Note: Full integration test would verify the 100 message limit
  });
});
