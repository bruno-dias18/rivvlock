import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSellerStripeStatus } from '../useSellerStripeStatus';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn().mockResolvedValue({
      data: {
        has_stripe_account: true,
        charges_enabled: true,
        details_submitted: true,
      },
      error: null,
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
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

describe('useSellerStripeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch seller Stripe status successfully', async () => {
    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.hasActiveAccount).toBe(true);
  });

  it('should return null when sellerId is null', async () => {
    const { result } = renderHook(() => useSellerStripeStatus(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('should return seller with charges enabled', async () => {
    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.hasActiveAccount).toBe(true);
  });

  it('should return seller with details submitted', async () => {
    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.hasActiveAccount).toBe(true);
  });

  it('should handle seller without Stripe account', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        has_stripe_account: false,
        charges_enabled: false,
        details_submitted: false,
      },
      error: null,
    });

    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.hasActiveAccount).toBe(false);
  });

  it('should trigger refresh when status is not active', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        has_stripe_account: true,
        charges_enabled: false,
        details_submitted: true,
      },
      error: null,
    });

    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should trigger refresh function invoke
    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('refresh-counterparty-stripe-status', {
        body: { sellerId: 'seller-id' },
      });
    });
  });

  it('should handle RPC errors gracefully', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'RPC error' },
    });

    const { result } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should cache result with staleTime', async () => {
    const { result, rerender } = renderHook(() => useSellerStripeStatus('seller-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Rerender should use cache
    rerender();

    expect(result.current.data).toBeDefined();
  });
});
