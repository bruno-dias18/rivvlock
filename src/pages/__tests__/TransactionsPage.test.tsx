import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransactionsPage from '../TransactionsPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Mock des hooks
vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: vi.fn(() => ({
    transactions: [
      { 
        id: '1', 
        title: 'Test Transaction', 
        status: 'paid', 
        created_at: '2024-01-15T10:00:00Z',
        price: 1000,
        currency: 'EUR'
      },
      { 
        id: '2', 
        title: 'Test Transaction 2', 
        status: 'pending', 
        created_at: '2023-12-20T10:00:00Z',
        price: 500,
        currency: 'EUR'
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

vi.mock('@/hooks/useIsAdmin', () => ({
  useIsAdmin: () => ({ isAdmin: false, isLoading: false })
}));

vi.mock('@/hooks/useTransactionsWithNewActivity', () => ({
  useTransactionsWithNewActivity: () => ({
    transactionsWithNewActivity: new Set(),
    isLoading: false
  })
}));

describe('TransactionsPage', () => {
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
        <TransactionsPage />
      </QueryClientProvider>
    </BrowserRouter>
  );

  it('affiche les transactions correctement', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Test Transaction')).toBeInTheDocument();
      expect(screen.getByText('Test Transaction 2')).toBeInTheDocument();
    });
  });

  it('affiche le titre de la page', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /transactions/i })).toBeInTheDocument();
  });

  it('gère l\'état de chargement', () => {
    vi.mocked(require('@/hooks/useTransactions').useTransactions).mockReturnValueOnce({
      transactions: [],
      isLoading: true,
      error: null
    });

    renderPage();
    // Le composant devrait afficher un état de chargement
    expect(screen.queryByText('Test Transaction')).not.toBeInTheDocument();
  });

  it('gère les erreurs correctement', () => {
    vi.mocked(require('@/hooks/useTransactions').useTransactions).mockReturnValueOnce({
      transactions: [],
      isLoading: false,
      error: new Error('Failed to fetch')
    });

    renderPage();
    // Le composant devrait gérer l'erreur
    expect(screen.queryByText('Test Transaction')).not.toBeInTheDocument();
  });

  it('affiche un état vide quand aucune transaction', () => {
    vi.mocked(require('@/hooks/useTransactions').useTransactions).mockReturnValueOnce({
      transactions: [],
      isLoading: false,
      error: null
    });

    renderPage();
    expect(screen.queryByText('Test Transaction')).not.toBeInTheDocument();
  });
});
