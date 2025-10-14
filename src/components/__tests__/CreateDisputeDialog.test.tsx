import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { CreateDisputeDialog } from '../CreateDisputeDialog';

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

const mockTransaction = {
  id: 'txn-123',
  title: 'Test Transaction',
  status: 'paid',
  price: 100,
  currency: 'EUR',
};

describe('CreateDisputeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText(/Ouvrir un litige/i)).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <CreateDisputeDialog
        open={false}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('should display transaction title in description', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText(/Test Transaction/i)).toBeInTheDocument();
  });

  it('should show dispute type selector', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText(/Type de problème/i)).toBeInTheDocument();
  });

  it('should show reason textarea', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByLabelText(/Description détaillée/i)).toBeInTheDocument();
  });

  it('should disable submit button when reason is too short', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when reason is long enough', async () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    const textarea = screen.getByLabelText(/Description détaillée/i);
    fireEvent.change(textarea, { target: { value: 'This is a detailed reason for the dispute that is long enough' } });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should call create-dispute edge function on submit', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const onDisputeCreated = vi.fn();

    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
        onDisputeCreated={onDisputeCreated}
      />
    );

    const textarea = screen.getByLabelText(/Description détaillée/i);
    fireEvent.change(textarea, { target: { value: 'This is a detailed reason for the dispute that is long enough' } });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
      expect(submitButton).not.toBeDisabled();
    });

    const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-dispute', {
        body: expect.objectContaining({
          transactionId: 'txn-123',
          disputeType: 'quality_issue',
          reason: expect.any(String),
        }),
      });
    });
  });

  it('should show loading state while creating', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: {}, error: null }), 1000))
    );

    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    const textarea = screen.getByLabelText(/Description détaillée/i);
    fireEvent.change(textarea, { target: { value: 'This is a detailed reason for the dispute that is long enough' } });

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
      expect(submitButton).not.toBeDisabled();
    });

    const submitButton = screen.getByRole('button', { name: /Créer le litige/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/Création\.\.\./i)).toBeInTheDocument();
    });
  });

  it('should handle cancel button', () => {
    const onOpenChange = vi.fn();
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={onOpenChange}
        transaction={mockTransaction}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Annuler/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show minimum character requirement', () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    expect(screen.getByText(/Au moins 20 caractères requis/i)).toBeInTheDocument();
  });

  it('should display dispute type options', async () => {
    render(
      <CreateDisputeDialog
        open={true}
        onOpenChange={vi.fn()}
        transaction={mockTransaction}
      />
    );

    // Click on the select trigger to open options
    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    await waitFor(() => {
      // Should show dispute type options
      expect(screen.getByText(/Problème de qualité/i)).toBeInTheDocument();
    });
  });
});
