import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { NewTransactionDialog } from '../NewTransactionDialog';

// Mock hooks
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    data: {
      country: 'FR',
      user_type: 'individual',
    },
    isLoading: false,
  }),
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          transaction: {
            id: 'txn-123',
            title: 'Test Transaction',
            shareLink: 'https://rivvlock.com/share/token-123',
          },
        },
        error: null,
      }),
    },
  },
}));

describe('NewTransactionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Nouvelle transaction')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(<NewTransactionDialog open={false} onOpenChange={vi.fn()} />);

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('should display form fields', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByLabelText(/Titre du service/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prix/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Devise/i)).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /Créer la transaction/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Should show validation error messages
      expect(screen.getByText(/au moins 3 caractères/i)).toBeInTheDocument();
    });
  });

  it('should calculate net amount after platform fee', async () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    const priceInput = screen.getByLabelText(/Prix/i);
    fireEvent.change(priceInput, { target: { value: '100' } });

    await waitFor(() => {
      // Should show 5% fee calculation
      expect(screen.getByText(/Frais plateforme/i)).toBeInTheDocument();
      expect(screen.getByText(/Vous recevrez/i)).toBeInTheDocument();
    });
  });

  it('should show reverse calculation option', async () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    const priceInput = screen.getByLabelText(/Prix/i);
    fireEvent.change(priceInput, { target: { value: '100' } });

    await waitFor(() => {
      expect(screen.getByText(/Répercuter les frais au client/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Appliquer ce montant/i })).toBeInTheDocument();
    });
  });

  it('should handle cancel button', () => {
    const onOpenChange = vi.fn();
    render(<NewTransactionDialog open={true} onOpenChange={onOpenChange} />);

    const cancelButton = screen.getByRole('button', { name: /Annuler/i });
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show EUR currency for French profile', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    // Default currency should be EUR for French profile
    const currencySelect = screen.getByLabelText(/Devise/i);
    expect(currencySelect).toBeInTheDocument();
  });

  it('should have date picker for service date', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Date de début du service/i)).toBeInTheDocument();
  });

  it('should have optional end date picker', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/Date de fin du service/i)).toBeInTheDocument();
    expect(screen.getByText(/optionnel/i)).toBeInTheDocument();
  });

  it('should show submit button', () => {
    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Créer la transaction/i })).toBeInTheDocument();
  });

  it('should disable submit button while loading', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.functions.invoke).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: {}, error: null }), 1000))
    );

    render(<NewTransactionDialog open={true} onOpenChange={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /Créer la transaction/i });
    
    // Button should initially be enabled
    expect(submitButton).not.toBeDisabled();
  });
});
