import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProfile } from '../useProfile';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

// Mock Supabase
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
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

describe('useProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch profile successfully', async () => {
    const mockProfile = {
      user_id: 'test-user-id',
      first_name: 'John',
      last_name: 'Doe',
      user_type: 'individual',
      country: 'FR',
      company_name: null,
    };

    mockMaybeSingle.mockResolvedValueOnce({
      data: mockProfile,
      error: null,
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProfile);
  });

  it('should handle company profile', async () => {
    const mockProfile = {
      user_id: 'test-user-id',
      user_type: 'company',
      company_name: 'Test Company',
      siret_uid: '12345678901234',
      vat_number: 'FR12345678901',
      country: 'FR',
    };

    mockMaybeSingle.mockResolvedValueOnce({
      data: mockProfile,
      error: null,
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.user_type).toBe('company');
    expect(result.current.data?.company_name).toBe('Test Company');
  });

  it('should handle independent profile', async () => {
    const mockProfile = {
      user_id: 'test-user-id',
      user_type: 'independent',
      first_name: 'Jane',
      last_name: 'Smith',
      avs_number: 'AVS123456',
      is_subject_to_vat: true,
      tva_rate: 20,
      country: 'FR',
    };

    mockMaybeSingle.mockResolvedValueOnce({
      data: mockProfile,
      error: null,
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.user_type).toBe('independent');
    expect(result.current.data?.is_subject_to_vat).toBe(true);
  });

  it('should handle profile not found', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    const { result } = renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should query with correct user_id', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { user_id: 'test-user-id' },
      error: null,
    });

    renderHook(() => useProfile(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });
  });
});
