import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuotes } from '../useQuotes';
import { supabase } from '@/integrations/supabase/client';
import * as AuthContext from '@/contexts/AuthContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('useQuotes', () => {
  let queryClient: QueryClient;
  const mockUser = { id: 'user-123' };

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

  it('should fetch quotes successfully', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        seller_id: mockUser.id,
        client_user_id: 'client-456',
        title: 'Web Development',
        items: [{ description: 'Frontend', amount: 100 }],
        archived_by_seller: false,
        archived_by_client: false,
        created_at: '2024-01-01T10:00:00Z',
      },
      {
        id: 'quote-2',
        seller_id: 'other-seller',
        client_user_id: mockUser.id,
        title: 'Design Work',
        items: [],
        archived_by_seller: false,
        archived_by_client: false,
        created_at: '2024-01-01T09:00:00Z',
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockQuotes, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.quotes).toHaveLength(2);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should filter out archived quotes based on user role', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        seller_id: mockUser.id,
        archived_by_seller: true, // Should be filtered for seller
        archived_by_client: false,
      },
      {
        id: 'quote-2',
        seller_id: 'other-seller',
        client_user_id: mockUser.id,
        archived_by_seller: false,
        archived_by_client: true, // Should be filtered for client
      },
      {
        id: 'quote-3',
        seller_id: mockUser.id,
        archived_by_seller: false, // Should be visible
        archived_by_client: false,
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockQuotes, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.quotes).toHaveLength(1);
      expect(result.current.quotes[0].id).toBe('quote-3');
    });
  });

  it('should separate sent and received quotes', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        seller_id: mockUser.id,
        client_user_id: 'client-456',
        archived_by_seller: false,
        archived_by_client: false,
      },
      {
        id: 'quote-2',
        seller_id: 'other-seller',
        client_user_id: mockUser.id,
        archived_by_seller: false,
        archived_by_client: false,
      },
      {
        id: 'quote-3',
        seller_id: mockUser.id,
        client_user_id: 'client-789',
        archived_by_seller: false,
        archived_by_client: false,
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockQuotes, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.sentQuotes).toHaveLength(2);
      expect(result.current.receivedQuotes).toHaveLength(1);
    });
  });

  it('should archive quote as seller', async () => {
    const mockQuote = {
      id: 'quote-1',
      seller_id: mockUser.id,
      client_user_id: 'client-456',
    };

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mockQuote], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockQuote, error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.archiveQuote('quote-1');
    });

    expect(mockSupabaseChain.update).toHaveBeenCalledWith({
      archived_by_seller: true,
      seller_archived_at: expect.any(String),
    });
  });

  it('should archive quote as client', async () => {
    const mockQuote = {
      id: 'quote-1',
      seller_id: 'other-seller',
      client_user_id: mockUser.id,
    };

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [mockQuote], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockQuote, error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.archiveQuote('quote-1');
    });

    expect(mockSupabaseChain.update).toHaveBeenCalledWith({
      archived_by_client: true,
      client_archived_at: expect.any(String),
    });
  });

  it('should resend quote email', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { client_email: 'client@example.com' },
      error: null,
    });

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.resendEmail('quote-1');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('resend-quote-email', {
      body: { quote_id: 'quote-1' },
    });
  });

  it('should update quote', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updateData = {
      title: 'Updated Title',
      description: 'Updated Description',
      items: [],
      currency: 'EUR',
      service_date: null,
      service_end_date: null,
      valid_until: '2024-12-31',
      total_amount: 200,
      fee_ratio_client: 50,
    };

    await act(async () => {
      await result.current.updateQuote({
        quoteId: 'quote-1',
        data: updateData,
      });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('update-quote', {
      body: {
        quote_id: 'quote-1',
        ...updateData,
      },
    });
  });

  it('should accept quote', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.acceptQuote({
        quoteId: 'quote-1',
        token: 'token-123',
      });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('accept-quote', {
      body: { quoteId: 'quote-1', token: 'token-123' },
    });
  });

  it('should mark quote as viewed silently', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {},
      error: null,
    });

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.markAsViewed('quote-1');
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('mark-quote-as-viewed', {
      body: { quoteId: 'quote-1' },
    });
  });

  it('should handle errors gracefully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should parse items from JSON', async () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        seller_id: mockUser.id,
        items: [{ description: 'Item 1', amount: 100 }],
        archived_by_seller: false,
        archived_by_client: false,
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockQuotes, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.quotes[0].items).toEqual([
        { description: 'Item 1', amount: 100 },
      ]);
    });
  });

  it('should throw error when not authenticated', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null } as any);

    const { result } = renderHook(() => useQuotes(), { wrapper });

    await waitFor(() => {
      expect(result.current.quotes).toEqual([]);
    });
  });
});
