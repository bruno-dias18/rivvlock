import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValidationStatus } from '../useValidationStatus';
import type { Transaction, TransactionStatus, DateChangeStatus } from '@/types';

describe('useValidationStatus', () => {
  const baseTransaction: Transaction = {
    id: 'tx-123',
    user_id: 'seller-123',
    buyer_id: 'buyer-456',
    title: 'Test Transaction',
    description: '',
    price: 100,
    currency: 'eur',
    status: 'pending',
    refund_status: null,
    refund_percentage: null,
    service_date: null,
    service_end_date: null,
    payment_deadline: null,
    payment_deadline_card: null,
    payment_deadline_bank: null,
    validation_deadline: null,
    stripe_payment_intent_id: null,
    stripe_transfer_id: null,
    payment_reference: null,
    shared_link_token: null,
    shared_link_expires_at: null,
    funds_released_at: null,
    seller_validated_at: null,
    buyer_validated_at: null,
    date_change_status: null,
    requested_service_date: null,
    date_change_message: null,
    renewal_count: 0,
    conversation_id: 'conv-123',
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  };

  it('should return pending status when no transaction', () => {
    const { result } = renderHook(() => useValidationStatus(undefined, 'user-123'));

    expect(result.current.phase).toBe('pending');
    expect(result.current.canFinalize).toBe(false);
    expect(result.current.displayLabel).toBe('En attente');
  });

  it('should return pending status when no userId', () => {
    const { result } = renderHook(() => useValidationStatus(baseTransaction, undefined));

    expect(result.current.phase).toBe('pending');
    expect(result.current.canFinalize).toBe(false);
  });

  it('should detect pending date change status', () => {
    const transaction: Transaction = {
      ...baseTransaction,
      date_change_status: 'pending_approval' as DateChangeStatus,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('pending');
    expect(result.current.displayLabel).toBe('Modification de date en attente');
    expect(result.current.displayColor).toBe('secondary');
  });

  it('should detect disputed status', () => {
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'disputed' as TransactionStatus,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('disputed');
    expect(result.current.displayLabel).toBe('En litige');
    expect(result.current.displayColor).toBe('destructive');
    expect(result.current.canDispute).toBe(false);
  });

  it('should detect completed/validated status', () => {
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'validated' as TransactionStatus,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('completed');
    expect(result.current.displayLabel).toBe('Terminé');
    expect(result.current.canFinalize).toBe(false);
  });

  it('should detect expired payment deadline', () => {
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'expired' as TransactionStatus,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('expired');
    expect(result.current.displayLabel).toBe('Délai de paiement expiré');
    expect(result.current.displayColor).toBe('destructive');
  });

  it('should detect pending payment status', () => {
    const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'pending' as TransactionStatus,
      payment_deadline: futureDeadline,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('pending');
    expect(result.current.displayLabel).toBe('En attente de paiement');
    expect(result.current.displayColor).toBe('secondary');
  });

  it('should detect real-time expired payment deadline', () => {
    const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'pending' as TransactionStatus,
      payment_deadline: pastDeadline,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('expired');
    expect(result.current.displayLabel).toBe('Délai de paiement expiré');
  });

  it('should respect grace period for reactivated transactions', () => {
    const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
    const recentUpdate = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'pending' as TransactionStatus,
      payment_deadline: pastDeadline,
      date_change_status: 'approved' as DateChangeStatus,
      updated_at: recentUpdate,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('pending');
    expect(result.current.displayLabel).toBe('En attente de paiement');
  });

  it('should detect service pending status (future service date)', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      service_date: futureDate,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('service_pending');
    expect(result.current.displayLabel).toBe('Service en cours');
    expect(result.current.canFinalize).toBe(true); // Buyer can finalize
    expect(result.current.canDispute).toBe(true);
  });

  it('should detect active validation deadline', () => {
    const futureDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const pastServiceDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      service_date: pastServiceDate,
      validation_deadline: futureDeadline,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('validation_active');
    expect(result.current.isValidationDeadlineActive).toBe(true);
    expect(result.current.timeRemaining).toBeGreaterThan(0);
    expect(result.current.displayLabel).toBe('Validation en cours');
    expect(result.current.canFinalize).toBe(true);
  });

  it('should detect expired validation deadline', () => {
    const pastDeadline = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const pastServiceDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      service_date: pastServiceDate,
      validation_deadline: pastDeadline,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('validation_expired');
    expect(result.current.timeRemaining).toBe(0);
    expect(result.current.displayLabel).toBe('Finalisation automatique');
  });

  it('should allow buyer to finalize but not seller', () => {
    const futureDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      validation_deadline: futureDeadline,
    };

    // Test as buyer
    const { result: buyerResult } = renderHook(() => 
      useValidationStatus(transaction, 'buyer-456')
    );
    expect(buyerResult.current.canFinalize).toBe(true);

    // Test as seller
    const { result: sellerResult } = renderHook(() => 
      useValidationStatus(transaction, 'seller-123')
    );
    expect(sellerResult.current.canFinalize).toBe(false);
  });

  it('should allow buyer to dispute but not seller', () => {
    const futureDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      validation_deadline: futureDeadline,
    };

    // Test as buyer
    const { result: buyerResult } = renderHook(() => 
      useValidationStatus(transaction, 'buyer-456')
    );
    expect(buyerResult.current.canDispute).toBe(true);

    // Test as seller
    const { result: sellerResult } = renderHook(() => 
      useValidationStatus(transaction, 'seller-123')
    );
    expect(sellerResult.current.canDispute).toBe(false);
  });

  it('should use service_end_date over service_date when available', () => {
    const futureEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const pastStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
      service_date: pastStartDate,
      service_end_date: futureEndDate,
    };

    const { result } = renderHook(() => useValidationStatus(transaction, 'buyer-456'));

    expect(result.current.phase).toBe('service_pending');
    expect(result.current.displayLabel).toBe('Service en cours');
  });

  it('should memoize result and only recalculate on dependency change', () => {
    const transaction: Transaction = {
      ...baseTransaction,
      status: 'paid' as TransactionStatus,
    };

    const { result, rerender } = renderHook(
      ({ tx, uid }) => useValidationStatus(tx, uid),
      { initialProps: { tx: transaction, uid: 'buyer-456' } }
    );

    const firstResult = result.current;

    // Rerender with same props
    rerender({ tx: transaction, uid: 'buyer-456' });
    expect(result.current).toBe(firstResult); // Same reference = memoized

    // Rerender with different userId
    rerender({ tx: transaction, uid: 'seller-123' });
    expect(result.current).not.toBe(firstResult); // Different reference = recalculated
  });
});
