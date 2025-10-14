import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisputeMessageReads } from '../useDisputeMessageReads';
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
    auth: {
      getUser: vi.fn(() => 
        Promise.resolve({ 
          data: { user: { id: 'test-user-id' } },
          error: null 
        })
      ),
    },
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock useToast
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useDisputeMessageReads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide markDisputeAsSeen function', () => {
    const { result } = renderHook(() => useDisputeMessageReads(), {
      wrapper: createWrapper(),
    });

    expect(result.current.markDisputeAsSeen).toBeDefined();
    expect(typeof result.current.markDisputeAsSeen).toBe('function');
  });

  it('should provide isMarking status', () => {
    const { result } = renderHook(() => useDisputeMessageReads(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isMarking).toBeDefined();
    expect(typeof result.current.isMarking).toBe('boolean');
    expect(result.current.isMarking).toBe(false);
  });

  it('should call supabase upsert when marking dispute as seen', async () => {
    const { result } = renderHook(() => useDisputeMessageReads(), {
      wrapper: createWrapper(),
    });

    const disputeId = 'test-dispute-id';
    const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
    
    vi.mocked(supabase.from).mockReturnValue({
      upsert: mockUpsert,
    } as any);

    result.current.markDisputeAsSeen(disputeId);

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('dispute_message_reads');
    });
  });

  it('should handle authentication errors gracefully', async () => {
    const { result } = renderHook(() => useDisputeMessageReads(), {
      wrapper: createWrapper(),
    });

    // Mock auth failure
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Not authenticated' } as any,
    });

    result.current.markDisputeAsSeen('test-dispute-id');

    // Should not throw, error is handled internally
    await waitFor(() => {
      expect(result.current.isMarking).toBe(false);
    });
  });

  it('should handle database errors gracefully', async () => {
    const { result } = renderHook(() => useDisputeMessageReads(), {
      wrapper: createWrapper(),
    });

    const mockUpsert = vi.fn(() => 
      Promise.resolve({ error: { message: 'DB error' } })
    );
    
    vi.mocked(supabase.from).mockReturnValue({
      upsert: mockUpsert,
    } as any);

    result.current.markDisputeAsSeen('test-dispute-id');

    // Should handle error without throwing
    await waitFor(() => {
      expect(result.current.isMarking).toBe(false);
    });
  });
});
