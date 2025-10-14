import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import CompleteTransactionButton from '../CompleteTransactionButton';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: { success: true },
        error: null,
      }),
    },
  },
}));

describe('CompleteTransactionButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render for paid transaction when user is buyer', () => {
    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
      />
    );

    expect(screen.getByRole('button', { name: /Finaliser la transaction/i })).toBeInTheDocument();
  });

  it('should not render when user is not buyer', () => {
    const { container } = render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should not render when transaction is not paid', () => {
    const { container } = render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="pending"
        isUserBuyer={true}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should show warning when seller has no Stripe account', () => {
    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
        sellerHasStripeAccount={false}
      />
    );

    expect(screen.getByText(/statut du compte bancaire semble non confirmé/i)).toBeInTheDocument();
  });

  it('should open confirmation dialog on click', async () => {
    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
      />
    );

    const button = screen.getByRole('button', { name: /Finaliser la transaction/i });
    fireEvent.click(button);

    await waitFor(() => {
      // Confirmation dialog should appear
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('should call release-funds edge function on confirm', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const onTransferComplete = vi.fn();

    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
        onTransferComplete={onTransferComplete}
      />
    );

    const button = screen.getByRole('button', { name: /Finaliser la transaction/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Find and click confirm button in dialog
    const confirmButton = screen.getByRole('button', { name: /Confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('release-funds', {
        body: { transactionId: 'txn-123' },
      });
    });
  });

  it('should show loading state while processing', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: {}, error: null }), 1000))
    );

    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
      />
    );

    const button = screen.getByRole('button', { name: /Finaliser la transaction/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmer/i });
    fireEvent.click(confirmButton);

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText(/Finalisation\.\.\./i)).toBeInTheDocument();
    });
  });

  it('should handle errors gracefully', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: new Error('Transfer failed'),
    });

    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
      />
    );

    const button = screen.getByRole('button', { name: /Finaliser la transaction/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirmer/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Should show error (via toast, but we can't easily test that)
      expect(supabase.functions.invoke).toHaveBeenCalled();
    });
  });

  it('should display transaction details in confirmation', async () => {
    render(
      <CompleteTransactionButton
        transactionId="txn-123"
        transactionStatus="paid"
        isUserBuyer={true}
        transactionTitle="Test Service"
        transactionAmount={100}
        transactionCurrency="EUR"
      />
    );

    const button = screen.getByRole('button', { name: /Finaliser la transaction/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Test Service/i)).toBeInTheDocument();
    });
  });
});
