import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminStats } from '../useAdminStats';

// Mock Supabase
const mockSelect = vi.fn().mockReturnThis();
const mockGte = vi.fn().mockReturnThis();
const mockLt = vi.fn().mockReturnThis();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      gte: mockGte,
      lt: mockLt,
    })),
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

describe('useAdminStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch admin stats successfully', async () => {
    // Mock users count
    mockSelect.mockResolvedValueOnce({ count: 100, error: null });
    mockSelect.mockResolvedValueOnce({ count: 30, error: null });
    mockSelect.mockResolvedValueOnce({ count: 20, error: null });

    // Mock transactions count and data
    mockSelect.mockResolvedValueOnce({ count: 200, error: null });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 100, status: 'paid', currency: 'EUR' },
        { price: 200, status: 'validated', currency: 'EUR' },
      ],
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 150, status: 'paid', currency: 'EUR' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.usersCount).toBe(100);
    expect(result.current.data?.transactionsCount).toBe(200);
  });

  it('should calculate volumes by currency', async () => {
    mockSelect.mockResolvedValueOnce({ count: 100, error: null });
    mockSelect.mockResolvedValueOnce({ count: 30, error: null });
    mockSelect.mockResolvedValueOnce({ count: 20, error: null });
    mockSelect.mockResolvedValueOnce({ count: 50, error: null });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 100, status: 'paid', currency: 'EUR' },
        { price: 200, status: 'validated', currency: 'CHF' },
      ],
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.volumesByCurrency).toBeDefined();
    expect(result.current.data?.volumesByCurrency['EUR']).toBeGreaterThan(0);
  });

  it('should calculate conversion rate', async () => {
    mockSelect.mockResolvedValueOnce({ count: 100, error: null });
    mockSelect.mockResolvedValueOnce({ count: 30, error: null });
    mockSelect.mockResolvedValueOnce({ count: 20, error: null });
    mockSelect.mockResolvedValueOnce({ count: 50, error: null });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 100, status: 'paid', currency: 'EUR' },
        { price: 200, status: 'pending', currency: 'EUR' },
      ],
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 100, status: 'paid', currency: 'EUR' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.conversionRate).toBeDefined();
    expect(result.current.data?.conversionRate).toBeGreaterThanOrEqual(0);
    expect(result.current.data?.conversionRate).toBeLessThanOrEqual(100);
  });

  it('should calculate trends', async () => {
    mockSelect.mockResolvedValueOnce({ count: 100, error: null });
    mockSelect.mockResolvedValueOnce({ count: 30, error: null });
    mockSelect.mockResolvedValueOnce({ count: 20, error: null });
    mockSelect.mockResolvedValueOnce({ count: 50, error: null });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 100, status: 'paid', currency: 'EUR' },
      ],
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: [
        { price: 80, status: 'paid', currency: 'EUR' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.usersTrend).toBeDefined();
    expect(result.current.data?.transactionsTrend).toBeDefined();
    expect(result.current.data?.volumeTrendsByCurrency).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    mockSelect.mockResolvedValueOnce({
      count: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should handle zero transactions', async () => {
    mockSelect.mockResolvedValueOnce({ count: 100, error: null });
    mockSelect.mockResolvedValueOnce({ count: 30, error: null });
    mockSelect.mockResolvedValueOnce({ count: 20, error: null });
    mockSelect.mockResolvedValueOnce({ count: 0, error: null });
    mockSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useAdminStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.transactionsCount).toBe(0);
    expect(result.current.data?.conversionRate).toBe(0);
  });
});
