import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { UserMenu } from '../UserMenu';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render user initials button', () => {
    render(<UserMenu />);

    // Should show user initials (TE for test@example.com)
    expect(screen.getByRole('button')).toHaveTextContent('TE');
  });

  it('should open popover on click', async () => {
    render(<UserMenu />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      // Should show user email in popover
      expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    });
  });

  it('should display language selector in popover', async () => {
    render(<UserMenu />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      // Should show language selector
      expect(screen.getByText(/Langue/i)).toBeInTheDocument();
    });
  });

  it('should display logout button in popover', async () => {
    render(<UserMenu />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Déconnexion/i })).toBeInTheDocument();
    });
  });

  it('should call logout function on logout button click', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      logout: mockLogout,
    } as any);

    render(<UserMenu />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Déconnexion/i })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: /Déconnexion/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should extract initials correctly from email', () => {
    render(<UserMenu />);

    // For test@example.com, initials should be TE
    expect(screen.getByRole('button')).toHaveTextContent('TE');
  });

  it('should handle single character email', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'a@b.com' },
      logout: vi.fn(),
    } as any);

    render(<UserMenu />);

    // For a@b.com, should show 'A'
    expect(screen.getByRole('button')).toHaveTextContent('A');
  });

  it('should show loading state while logging out', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    const mockLogout = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(undefined), 1000))
    );
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      logout: mockLogout,
    } as any);

    render(<UserMenu />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Déconnexion/i })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: /Déconnexion/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      // Should show loading state
      expect(screen.getByText(/Déconnexion\.\.\./i)).toBeInTheDocument();
    });
  });

  it('should close popover after logout', async () => {
    const { useAuth } = await import('@/contexts/AuthContext');
    const mockLogout = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-user-id', email: 'test@example.com' },
      logout: mockLogout,
    } as any);

    render(<UserMenu />);

    const menuButton = screen.getByRole('button');
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Déconnexion/i })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: /Déconnexion/i });
    fireEvent.click(logoutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});
