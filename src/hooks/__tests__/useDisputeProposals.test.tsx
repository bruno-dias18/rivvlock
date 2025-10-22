import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDisputeProposals } from '../useDisputeProposals';
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

vi.mock('@/lib/errorMessages', () => ({
  getUserFriendlyError: vi.fn((err) => err.message || 'Error'),
}));

describe('useDisputeProposals', () => {
  let queryClient: QueryClient;
  const mockUser = { id: 'user-123' };
  const mockDisputeId = 'dispute-456';

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

  it('should fetch proposals successfully', async () => {
    const mockProposals = [
      {
        id: 'prop-1',
        dispute_id: mockDisputeId,
        proposal_type: 'partial_refund',
        refund_percentage: 50,
        status: 'pending',
        admin_created: false,
        created_at: '2024-01-01T10:00:00Z',
      },
      {
        id: 'prop-2',
        dispute_id: mockDisputeId,
        proposal_type: 'full_refund',
        refund_percentage: 100,
        status: 'pending',
        admin_created: true,
        created_at: '2024-01-01T09:00:00Z',
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProposals, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => {
      expect(result.current.proposals).toEqual(mockProposals);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should separate admin and user proposals', async () => {
    const mockProposals = [
      { id: 'prop-1', admin_created: false },
      { id: 'prop-2', admin_created: true },
      { id: 'prop-3', admin_created: false },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockProposals, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => {
      expect(result.current.adminProposals).toHaveLength(1);
      expect(result.current.userProposals).toHaveLength(2);
      expect(result.current.adminProposals[0].id).toBe('prop-2');
    });
  });

  it('should create proposal successfully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        proposal: {
          id: 'new-prop',
          proposal_type: 'partial_refund',
          refund_percentage: 50,
        },
      },
      error: null,
    });

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createProposal({
        proposalType: 'partial_refund',
        refundPercentage: 50,
        message: 'My proposal',
      });
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-proposal', {
      body: {
        disputeId: mockDisputeId,
        proposalType: 'partial_refund',
        refundPercentage: 50,
        message: 'My proposal',
      },
    });
  });

  it('should accept proposal successfully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { success: true },
      error: null,
    });

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const response = await result.current.acceptProposal('prop-123');
      expect(response.success).toBe(true);
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('accept-proposal', {
      body: { proposalId: 'prop-123' },
    });
  });

  it('should handle partial success on accept proposal', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        partial_success: true,
        warnings: ['Some updates failed'],
      },
      error: null,
    });

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      const response = await result.current.acceptProposal('prop-123');
      expect(response.partial).toBe(true);
      expect(response.warnings).toEqual(['Some updates failed']);
    });
  });

  it('should reject proposal successfully', async () => {
    const mockProposal = {
      dispute_id: mockDisputeId,
      proposal_type: 'partial_refund',
      refund_percentage: 50,
    };

    const mockDispute = {
      transactions: {
        conversation_id: 'conv-789',
      },
    };

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    // Setup different responses for different queries
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'quotes') {
        return {
          ...mockSupabaseChain,
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      }
      if (table === 'dispute_proposals') {
        return {
          ...mockSupabaseChain,
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn()
            .mockResolvedValueOnce({ data: mockProposal, error: null })
            .mockResolvedValueOnce({ data: mockProposal, error: null }),
        } as any;
      }
      if (table === 'disputes') {
        return {
          ...mockSupabaseChain,
          maybeSingle: vi.fn().mockResolvedValue({ data: mockDispute, error: null }),
        } as any;
      }
      return mockSupabaseChain as any;
    });

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.rejectProposal('prop-123');
    });

    // Verify proposal was updated
    expect(mockSupabaseChain.update).toHaveBeenCalledWith({
      status: 'rejected',
      updated_at: expect.any(String),
    });
  });

  it('should throw error when user not authenticated for reject', async () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null } as any);

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.proposals).toEqual([]));

    await expect(
      act(async () => {
        await result.current.rejectProposal('prop-123');
      })
    ).rejects.toThrow('User not authenticated');
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should provide loading states for mutations', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
    );

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.createProposal({
        proposalType: 'partial_refund',
        refundPercentage: 50,
      });
    });

    expect(result.current.isCreating).toBe(true);

    await waitFor(() => expect(result.current.isCreating).toBe(false));
  });

  it('should invalidate queries after successful operations', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { proposal: { id: 'new' } },
      error: null,
    });

    const { result } = renderHook(() => useDisputeProposals(mockDisputeId), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.createProposal({
        proposalType: 'partial_refund',
        refundPercentage: 50,
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
      queryKey: ['dispute-proposals', mockDisputeId] 
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
  });
});
