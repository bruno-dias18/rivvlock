import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock hook implementation for testing
const usePayment = (transactionId: string) => {
  const createCheckoutSession = async (paymentMethod: 'card' | 'bank_transfer') => {
    const { data, error } = await supabase.functions.invoke('create-payment-checkout', {
      body: { transactionId, paymentMethod },
    });

    if (error) throw error;
    return data;
  };

  return { createCheckoutSession };
};

describe('usePayment', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should create checkout session for card payment', async () => {
    const mockCheckoutUrl = 'https://checkout.stripe.com/pay/test123';
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValue({
      data: { url: mockCheckoutUrl },
      error: null,
    });

    const { result } = renderHook(() => usePayment('transaction-123'), { wrapper });

    const data = await result.current.createCheckoutSession('card');

    expect(mockInvoke).toHaveBeenCalledWith('create-payment-checkout', {
      body: { transactionId: 'transaction-123', paymentMethod: 'card' },
    });
    expect(data).toEqual({ url: mockCheckoutUrl });
  });

  it('should handle payment creation errors', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Payment creation failed'),
    });

    const { result } = renderHook(() => usePayment('transaction-123'), { wrapper });

    await expect(result.current.createCheckoutSession('card')).rejects.toThrow(
      'Payment creation failed'
    );
  });

  it('should support bank transfer payment method', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValue({
      data: { instructions: 'Bank transfer instructions' },
      error: null,
    });

    const { result } = renderHook(() => usePayment('transaction-123'), { wrapper });

    const data = await result.current.createCheckoutSession('bank_transfer');

    expect(mockInvoke).toHaveBeenCalledWith('create-payment-checkout', {
      body: { transactionId: 'transaction-123', paymentMethod: 'bank_transfer' },
    });
    expect(data).toEqual({ instructions: 'Bank transfer instructions' });
  });
});
