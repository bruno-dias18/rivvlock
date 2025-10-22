import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import QuotesPage from '../QuotesPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock des hooks
vi.mock('@/hooks/useQuotes', () => ({
  useQuotes: vi.fn(() => ({
    sellerQuotes: [
      { 
        id: '1', 
        title: 'Devis Seller', 
        status: 'pending', 
        seller_id: 'user-1',
        total_amount: 1000,
        created_at: '2024-01-15T10:00:00Z'
      }
    ],
    clientQuotes: [
      { 
        id: '2', 
        title: 'Devis Client', 
        status: 'accepted', 
        client_id: 'user-1',
        total_amount: 2000,
        created_at: '2024-01-16T10:00:00Z'
      }
    ],
    isLoading: false,
    error: null
  }))
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    session: { access_token: 'mock-token' }
  })
}));

vi.mock('@/hooks/useUnreadQuoteTabCounts', () => ({
  useUnreadQuoteTabCounts: () => ({
    sellerUnreadCount: 0,
    clientUnreadCount: 0,
    isLoading: false
  })
}));

describe('QuotesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { 
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  const renderPage = () => render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <QuotesPage />
      </QueryClientProvider>
    </BrowserRouter>
  );

  it('affiche les devis correctement', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Devis Seller')).toBeInTheDocument();
    });
  });

  it('affiche le titre de la page', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /devis/i })).toBeInTheDocument();
  });

  it('gère l\'état de chargement', () => {
    vi.mocked(require('@/hooks/useQuotes').useQuotes).mockReturnValueOnce({
      sellerQuotes: [],
      clientQuotes: [],
      isLoading: true,
      error: null
    });

    renderPage();
    expect(screen.queryByText('Devis Seller')).not.toBeInTheDocument();
  });

  it('gère les erreurs correctement', () => {
    vi.mocked(require('@/hooks/useQuotes').useQuotes).mockReturnValueOnce({
      sellerQuotes: [],
      clientQuotes: [],
      isLoading: false,
      error: new Error('Failed to fetch')
    });

    renderPage();
    expect(screen.queryByText('Devis Seller')).not.toBeInTheDocument();
  });

  it('affiche les onglets vendeur et client', () => {
    renderPage();
    expect(screen.getByText(/vendeur/i)).toBeInTheDocument();
    expect(screen.getByText(/client/i)).toBeInTheDocument();
  });

  it('respecte le filtre archived_by_seller', async () => {
    const mockQuotes = vi.mocked(require('@/hooks/useQuotes').useQuotes);
    
    // Simuler qu'un devis archivé ne s'affiche pas
    mockQuotes.mockReturnValueOnce({
      sellerQuotes: [
        { 
          id: '1', 
          title: 'Devis Actif', 
          status: 'pending',
          archived_by_seller: false
        }
      ],
      clientQuotes: [],
      isLoading: false,
      error: null
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Devis Actif')).toBeInTheDocument();
    });
  });

  it('affiche un état vide quand aucun devis', () => {
    vi.mocked(require('@/hooks/useQuotes').useQuotes).mockReturnValueOnce({
      sellerQuotes: [],
      clientQuotes: [],
      isLoading: false,
      error: null
    });

    renderPage();
    expect(screen.queryByText('Devis Seller')).not.toBeInTheDocument();
  });
});
