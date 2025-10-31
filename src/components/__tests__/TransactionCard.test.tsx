import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { TransactionCard } from '../TransactionCard';
import type { Transaction } from '@/types';

// Mock hooks
vi.mock('@/hooks/useValidationStatus', () => ({
  useValidationStatus: () => ({
    canComplete: true,
    phase: 'service_completed',
    isExpired: false
  })
}));

vi.mock('@/hooks/useUnreadTransactionConversationMessages', () => ({
  useUnreadTransactionConversationMessages: () => ({
    unreadCount: 0
  })
}));

vi.mock('@/hooks/useHasTransactionMessages', () => ({
  useHasTransactionMessages: () => false
}));

vi.mock('@/lib/mobileUtils', () => ({
  useIsMobile: () => false
}));

const mockTransaction: Transaction = {
  id: '123',
  title: 'Test Transaction',
  description: 'Test description',
  price: 1000,
  currency: 'eur',
  status: 'paid',
  user_id: 'seller-123',
  buyer_id: 'buyer-456',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  service_date: '2024-02-01T10:00:00Z',
  service_end_date: null,
  payment_deadline: '2024-01-20T10:00:00Z',
  payment_deadline_card: '2024-01-20T10:00:00Z',
  payment_deadline_bank: '2024-01-17T10:00:00Z',
  validation_deadline: '2024-02-10T10:00:00Z',
  seller_validated_at: null,
  buyer_validated_at: null,
  funds_released_at: null,
  date_change_status: null,
  requested_service_date: null,
  date_change_message: null,
  refund_status: 'none',
  refund_percentage: null,
  payment_method: 'card',
  stripe_payment_intent_id: null,
  stripe_transfer_id: null,
  payment_reference: null,
  shared_link_token: null,
  shared_link_expires_at: null,
  seller_display_name: 'John Seller',
  buyer_display_name: 'Jane Buyer',
  conversation_id: null,
  renewal_count: 0
};

describe('TransactionCard', () => {
  const mockUser = { id: 'seller-123' };
  const mockOnCopyLink = vi.fn();
  const mockOnPayment = vi.fn();
  const mockOnRefetch = vi.fn();
  const mockOnOpenDispute = vi.fn();
  const mockOnDownloadInvoice = vi.fn();
  const mockCompleteButton = () => <button>Complete</button>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre et la description', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.getByText('Test Transaction')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('affiche le prix formaté', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.getByText(/1000\.00/)).toBeInTheDocument();
    expect(screen.getByText(/EUR/)).toBeInTheDocument();
  });

  it('affiche le badge de statut', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.getByText(/payée/i)).toBeInTheDocument();
  });

  it('affiche le badge de nouvelle activité', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        hasNewActivity={true}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.getByText(/nouvelle activité/i)).toBeInTheDocument();
  });

  it('ouvre le dialog de détails au clic', async () => {
    const user = userEvent.setup();
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    const card = screen.getByTestId('transaction-card');
    await user.click(card);

    await waitFor(() => {
      expect(screen.getByText(/détails de la transaction/i)).toBeInTheDocument();
    });
  });

  it('affiche les actions pour le vendeur', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        showActions={true}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.getByText(/télécharger la facture/i)).toBeInTheDocument();
  });

  it('masque les actions si showActions=false', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        showActions={false}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    expect(screen.queryByText(/télécharger la facture/i)).not.toBeInTheDocument();
  });

  it('affiche le nom de la contrepartie', () => {
    render(
      <TransactionCard
        transaction={mockTransaction}
        user={mockUser}
        onCopyLink={mockOnCopyLink}
        onPayment={mockOnPayment}
        onRefetch={mockOnRefetch}
        onOpenDispute={mockOnOpenDispute}
        onDownloadInvoice={mockOnDownloadInvoice}
        CompleteButtonComponent={mockCompleteButton}
      />
    );

    // Le vendeur voit le nom de l'acheteur
    expect(screen.getByText(/Jane Buyer/)).toBeInTheDocument();
  });
});
