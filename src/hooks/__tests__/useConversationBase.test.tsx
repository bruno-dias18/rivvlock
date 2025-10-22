import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationBase } from '../useConversationBase';
import { supabase } from '@/integrations/supabase/client';
import * as AuthContext from '@/contexts/AuthContext';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useConversationBase', () => {
  let queryClient: QueryClient;
  const mockUser = { id: 'user-123' };
  const mockConversationId = 'conv-456';

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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when conversationId is null', async () => {
    const { result } = renderHook(
      () => useConversationBase(null, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.messages).toEqual([]));
  });

  it('should fetch messages successfully', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        conversation_id: mockConversationId,
        sender_id: 'user-456',
        message: 'Hello',
        message_type: 'text',
        created_at: '2024-01-01T10:00:00Z',
      },
      {
        id: 'msg-2',
        conversation_id: mockConversationId,
        sender_id: mockUser.id,
        message: 'Hi there',
        message_type: 'text',
        created_at: '2024-01-01T10:30:00Z',
      },
    ];

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useConversationBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.messages).toEqual(mockMessages));
    expect(result.current.isLoading).toBe(false);
  });

  it('should send message successfully', async () => {
    const mockMessages = [];
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockMessages, error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useConversationBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.messages).toEqual([]));

    await act(async () => {
      await result.current.sendMessage('Test message');
    });

    expect(mockSupabaseChain.insert).toHaveBeenCalledWith({
      conversation_id: mockConversationId,
      sender_id: mockUser.id,
      message: 'Test message',
      message_type: 'text',
    });
  });

  it('should throw error when sending message without conversation', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useConversationBase(null, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.messages).toEqual([]));

    await expect(
      act(async () => {
        await result.current.sendMessage('Test message');
      })
    ).rejects.toThrow('Missing conversation or user');
  });

  it('should subscribe to real-time updates', async () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    };

    vi.mocked(supabase.channel).mockReturnValue(mockChannel as any);

    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    renderHook(
      () => useConversationBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith(`messages:${mockConversationId}`);
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${mockConversationId}`,
        }),
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  it('should handle database errors gracefully', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      }),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useConversationBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should set isSendingMessage flag correctly', async () => {
    const mockSupabaseChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ error: null }), 100))
      ),
    };

    vi.mocked(supabase.from).mockReturnValue(mockSupabaseChain as any);

    const { result } = renderHook(
      () => useConversationBase(mockConversationId, ['test-key']),
      { wrapper }
    );

    await waitFor(() => expect(result.current.messages).toEqual([]));

    act(() => {
      result.current.sendMessage('Test message');
    });

    expect(result.current.isSendingMessage).toBe(true);

    await waitFor(() => expect(result.current.isSendingMessage).toBe(false));
  });
});
