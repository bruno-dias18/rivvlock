import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { QuoteCard } from '../QuoteCard';
import type { Quote } from '@/types/quotes';

// Mock hooks
vi.mock('@/hooks/useUnreadConversationMessages', () => ({
  useUnreadConversationMessages: () => ({
    unreadCount: 0
  })
}));

const mockQuote: Quote = {
  id: 'quote-123',
  seller_id: 'seller-123',
  client_email: 'client@example.com',
  client_name: 'Jean Client',
  title: 'Test Quote',
  description: 'Test quote description',
  items: [{ description: 'Item 1', quantity: 1, unit_price: 100, total: 100 }],
  subtotal: 100,
  tax_rate: 20,
  tax_amount: 20,
  total_amount: 120,
  currency: 'eur',
  status: 'pending',
  valid_until: '2024-12-31T23:59:59Z',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
  service_date: '2024-02-01T10:00:00Z',
  service_end_date: null,
  conversation_id: 'conv-123',
  client_user_id: null,
  converted_transaction_id: null,
  secure_token: 'abc123',
  token_expires_at: '2024-12-31T23:59:59Z',
  fee_ratio_client: 0,
  discount_percentage: 0,
  client_last_viewed_at: null
};

describe('QuoteCard', () => {
  const mockOnView = vi.fn();
  const mockOnArchive = vi.fn();
  const mockOnOpenMessaging = vi.fn();
  const mockOnMarkAsViewed = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le titre et le statut du devis', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.getByText('Test Quote')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('affiche le montant formaté', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.getByText(/120\.00/)).toBeInTheDocument();
    expect(screen.getByText(/EUR/)).toBeInTheDocument();
  });

  it('affiche le nom du client pour le vendeur', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.getByText(/Jean Client/)).toBeInTheDocument();
  });

  it('affiche le bouton Voir', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.getByRole('button', { name: /voir/i })).toBeInTheDocument();
  });

  it('appelle onView au clic sur Voir', async () => {
    const user = userEvent.setup();
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    const viewButton = screen.getByRole('button', { name: /voir/i });
    await user.click(viewButton);

    expect(mockOnView).toHaveBeenCalledWith(mockQuote);
  });

  it('affiche le bouton de messagerie', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        onOpenMessaging={mockOnOpenMessaging}
        isSeller={true}
      />
    );

    expect(screen.getByRole('button', { name: /contacter/i })).toBeInTheDocument();
  });

  it('appelle onOpenMessaging au clic sur le bouton de messagerie', async () => {
    const user = userEvent.setup();
    render(
      <QuoteCard
        quote={mockQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        onOpenMessaging={mockOnOpenMessaging}
        isSeller={true}
      />
    );

    const messagingButton = screen.getByRole('button', { name: /contacter/i });
    await user.click(messagingButton);

    expect(mockOnOpenMessaging).toHaveBeenCalledWith('quote-123', 'Jean Client');
  });

  it('affiche le bouton Archiver pour les devis refusés', () => {
    const refusedQuote = { ...mockQuote, status: 'refused' as const };
    render(
      <QuoteCard
        quote={refusedQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.getByRole('button', { name: /archiver/i })).toBeInTheDocument();
  });

  it('appelle onArchive au clic sur Archiver', async () => {
    const user = userEvent.setup();
    const refusedQuote = { ...mockQuote, status: 'refused' as const };
    render(
      <QuoteCard
        quote={refusedQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    const archiveButton = screen.getByRole('button', { name: /archiver/i });
    await user.click(archiveButton);

    expect(mockOnArchive).toHaveBeenCalledWith('quote-123');
  });

  it('affiche le badge "Modifié" pour le client si le devis a été mis à jour', () => {
    const modifiedQuote = {
      ...mockQuote,
      updated_at: '2024-01-16T10:00:00Z',
      client_last_viewed_at: '2024-01-15T10:00:00Z'
    };
    render(
      <QuoteCard
        quote={modifiedQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={false}
      />
    );

    expect(screen.getByText('Modifié')).toBeInTheDocument();
  });

  it('masque le badge "Modifié" pour le vendeur', () => {
    const modifiedQuote = {
      ...mockQuote,
      updated_at: '2024-01-16T10:00:00Z',
      client_last_viewed_at: '2024-01-15T10:00:00Z'
    };
    render(
      <QuoteCard
        quote={modifiedQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        isSeller={true}
      />
    );

    expect(screen.queryByText('Modifié')).not.toBeInTheDocument();
  });

  it('marque comme vu au clic si client et devis modifié', async () => {
    const user = userEvent.setup();
    const modifiedQuote = {
      ...mockQuote,
      updated_at: '2024-01-16T10:00:00Z',
      client_last_viewed_at: '2024-01-15T10:00:00Z'
    };
    render(
      <QuoteCard
        quote={modifiedQuote}
        onView={mockOnView}
        onArchive={mockOnArchive}
        onMarkAsViewed={mockOnMarkAsViewed}
        isSeller={false}
      />
    );

    const viewButton = screen.getByRole('button', { name: /voir/i });
    await user.click(viewButton);

    expect(mockOnMarkAsViewed).toHaveBeenCalledWith('quote-123');
  });
});
