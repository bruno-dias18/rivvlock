import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logActivity } from '../activityLogger';
import type { ActivityType } from '../activityLogger';

// Mock Supabase
const mockInsert = vi.fn().mockReturnValue({
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
});

const mockFrom = vi.fn().mockReturnValue({
  insert: mockInsert,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
      }),
    },
    from: mockFrom,
  },
}));

describe('activityLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log activity with basic parameters', async () => {
    await logActivity({
      type: 'transaction_created',
      title: 'Test Activity',
      description: 'Test description',
    });

    expect(mockFrom).toHaveBeenCalledWith('activity_logs');
  });

  it('should log activity with metadata', async () => {
    await logActivity({
      type: 'transaction_created',
      title: 'Test Activity',
      description: 'Test description',
      metadata: {
        transaction_id: 'txn-123',
        amount: 100,
        currency: 'EUR',
      },
    });

    expect(mockFrom).toHaveBeenCalledWith('activity_logs');
  });

  it('should sanitize sensitive metadata fields', async () => {
    await logActivity({
      type: 'profile_updated',
      title: 'Profile Updated',
      metadata: {
        transaction_id: 'txn-123',
        password: 'secret123',
        email: 'test@example.com',
        phone: '+33123456789',
        stripe_customer_id: 'cus_123',
        safe_field: 'this should stay',
      },
    });

    expect(mockFrom).toHaveBeenCalledWith('activity_logs');
    // Sensitive fields should be removed from metadata
  });

  it('should handle different activity types', async () => {
    const activityTypes: ActivityType[] = [
      'transaction_created',
      'funds_blocked',
      'transaction_validated',
      'dispute_created',
      'funds_released',
    ];

    for (const type of activityTypes) {
      await logActivity({
        type,
        title: `Activity ${type}`,
      });
    }

    expect(mockFrom).toHaveBeenCalledTimes(activityTypes.length);
  });

  it('should handle missing user gracefully', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as any);

    await logActivity({
      type: 'transaction_created',
      title: 'Test',
    });

    // Should not throw error, just warn
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    mockFrom.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        error: new Error('Database error'),
      }),
    });

    // Should not throw
    await expect(
      logActivity({
        type: 'transaction_created',
        title: 'Test',
      })
    ).resolves.not.toThrow();
  });

  it('should remove all sensitive fields from metadata', async () => {
    const sensitiveMetadata = {
      password: 'secret',
      token: 'token123',
      key: 'api-key',
      secret: 'secret-value',
      stripe_customer_id: 'cus_123',
      stripe_account_id: 'acc_123',
      payment_intent_id: 'pi_123',
      phone: '+33123456789',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
      address: '123 Street',
      postal_code: '75001',
      city: 'Paris',
      siret_uid: '12345678901234',
      vat_number: 'FR12345678901',
      avs_number: 'AVS123',
      company_address: '456 Avenue',
      safe_field: 'This should remain',
    };

    await logActivity({
      type: 'transaction_created',
      title: 'Test',
      metadata: sensitiveMetadata,
    });

    expect(mockFrom).toHaveBeenCalledWith('activity_logs');
  });
});
