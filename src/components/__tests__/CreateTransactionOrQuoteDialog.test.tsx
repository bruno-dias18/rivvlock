import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { CreateTransactionOrQuoteDialog } from '../CreateTransactionOrQuoteDialog';

// Mock hooks
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    data: {
      country: 'FR',
      user_type: 'company',
      vat_rate: 20,
      tva_rate: 20
    },
    isLoading: false
  })
}));

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { transaction: { id: '123' } }, error: null })
    }
  }
}));

describe('CreateTransactionOrQuoteDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le dialog quand open=true', () => {
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText('Nouvelle opération')).toBeInTheDocument();
  });

  it('affiche les deux onglets Transaction et Devis', () => {
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.getByRole('tab', { name: /transaction/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /devis/i })).toBeInTheDocument();
  });

  it('affiche les champs obligatoires', () => {
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.getByLabelText(/titre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/devise/i)).toBeInTheDocument();
  });

  it('affiche une erreur si le titre est vide', async () => {
    const user = userEvent.setup();
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    const submitButton = screen.getByRole('button', { name: /créer/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/veuillez remplir tous les champs obligatoires/i)).toBeInTheDocument();
    });
  });

  it('permet de basculer entre Transaction et Devis', async () => {
    const user = userEvent.setup();
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        defaultType="transaction"
      />
    );

    const quoteTab = screen.getByRole('tab', { name: /devis/i });
    await user.click(quoteTab);

    expect(quoteTab).toHaveAttribute('data-state', 'active');
  });

  it('calcule correctement le total avec TVA', async () => {
    const user = userEvent.setup();
    render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    // Remplir les champs de l'item
    const descriptionInput = screen.getAllByPlaceholderText(/description/i)[0];
    const priceInput = screen.getByPlaceholderText(/prix unitaire/i);

    await user.clear(priceInput);
    await user.type(priceInput, '100');
    await user.type(descriptionInput, 'Test item');

    // Vérifier le calcul (100 + 20% TVA = 120)
    await waitFor(() => {
      expect(screen.getByText(/120\.00/)).toBeInTheDocument();
    });
  });

  it('ferme le dialog quand onOpenChange(false)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CreateTransactionOrQuoteDialog
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.getByText('Nouvelle opération')).toBeInTheDocument();

    rerender(
      <CreateTransactionOrQuoteDialog
        open={false}
        onOpenChange={mockOnOpenChange}
      />
    );

    expect(screen.queryByText('Nouvelle opération')).not.toBeInTheDocument();
  });
});
