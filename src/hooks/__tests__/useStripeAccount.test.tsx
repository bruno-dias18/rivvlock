import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStripeAccount } from '../useStripeAccount';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          hasStripeAccount: true,
          chargesEnabled: true,
          detailsSubmitted: true,
        },
        error: null,
      }),
    },
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

describe('useStripeAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch Stripe account status successfully', async () => {
    const { result } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.has_active_account).toBe(true);
  });

  it('should return account with charges enabled', async () => {
    const { result } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.charges_enabled).toBe(true);
  });

  it('should return account with details submitted', async () => {
    const { result } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.details_submitted).toBe(true);
  });

  it('should handle account not setup', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        hasStripeAccount: false,
        chargesEnabled: false,
        detailsSubmitted: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.has_active_account).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new Error('Failed to fetch Stripe account'),
    });

    const { result } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should cache the result with staleTime', async () => {
    const { result, rerender } = renderHook(() => useStripeAccount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstFetchTime = Date.now();

    // Rerender should use cache
    rerender();

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeDefined();
  });
});
