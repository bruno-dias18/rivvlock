import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisputes } from '../useDisputes';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
const mockSelect = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockResolvedValue({ data: [], error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      order: mockOrder,
      in: mockIn,
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

describe('useDisputes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch disputes successfully', async () => {
    const mockDisputes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        transaction_id: '550e8400-e29b-41d4-a716-446655440002',
        reporter_id: '550e8400-e29b-41d4-a716-446655440003',
        status: 'open',
        dispute_type: 'quality_issue',
        reason: 'Test reason',
        created_at: new Date().toISOString(),
      },
    ];

    mockOrder.mockResolvedValueOnce({
      data: mockDisputes,
      error: null,
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
  });

  it('should return empty array when no disputes exist', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should filter archived disputes for seller', async () => {
    const mockDisputes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        transaction_id: '550e8400-e29b-41d4-a716-446655440005',
        reporter_id: '550e8400-e29b-41d4-a716-446655440006',
        status: 'open',
        archived_by_seller: true,
        archived_by_buyer: false,
      },
    ];

    const mockTransactions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        user_id: '550e8400-e29b-41d4-a716-446655440003', // Current user is seller
        buyer_id: '550e8400-e29b-41d4-a716-446655440013',
      },
    ];

    mockOrder.mockResolvedValueOnce({
      data: mockDisputes,
      error: null,
    });

    mockIn.mockResolvedValueOnce({
      data: mockTransactions,
      error: null,
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should filter out archived disputes
    expect(result.current.data).toEqual([]);
  });

  it('should filter archived disputes for buyer', async () => {
    const mockDisputes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440008',
        transaction_id: '550e8400-e29b-41d4-a716-446655440009',
        reporter_id: '550e8400-e29b-41d4-a716-446655440010',
        status: 'open',
        archived_by_seller: false,
        archived_by_buyer: true,
      },
    ];

    const mockTransactions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440009',
        user_id: '550e8400-e29b-41d4-a716-446655440014',
        buyer_id: '550e8400-e29b-41d4-a716-446655440003', // Current user is buyer
      },
    ];

    mockOrder.mockResolvedValueOnce({
      data: mockDisputes,
      error: null,
    });

    mockIn.mockResolvedValueOnce({
      data: mockTransactions,
      error: null,
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should filter out archived disputes
    expect(result.current.data).toEqual([]);
  });

  it('should enrich disputes with transaction data', async () => {
    const mockDisputes = [
      {
        id: '550e8400-e29b-41d4-a716-446655440011',
        transaction_id: '550e8400-e29b-41d4-a716-446655440012',
        reporter_id: '550e8400-e29b-41d4-a716-446655440003',
        status: 'open',
      },
    ];

    const mockTransactions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440012',
        title: 'Test Transaction',
        user_id: 'seller-id',
        buyer_id: 'test-user-id',
      },
    ];

    mockOrder.mockResolvedValueOnce({
      data: mockDisputes,
      error: null,
    });

    mockIn.mockResolvedValueOnce({
      data: mockTransactions,
      error: null,
    });

    const { result } = renderHook(() => useDisputes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]).toHaveProperty('transactions');
  });
});
