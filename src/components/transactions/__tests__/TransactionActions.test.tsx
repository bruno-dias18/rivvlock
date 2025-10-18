import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionActions } from '../TransactionActions';

// Mock useIsMobile hook
vi.mock('@/lib/mobileUtils', () => ({
  useIsMobile: () => false,
}));

describe('TransactionActions', () => {
  it('should render the title', () => {
    const mockOnNewTransaction = vi.fn();
    render(
      <TransactionActions 
        onNewTransaction={mockOnNewTransaction} 
        stripeReady={true}
      />
    );
    
    expect(screen.getByText('transactions.title')).toBeInTheDocument();
  });

  it('should render new transaction button', () => {
    const mockOnNewTransaction = vi.fn();
    render(
      <TransactionActions 
        onNewTransaction={mockOnNewTransaction} 
        stripeReady={true}
      />
    );
    
    expect(screen.getByText('transactions.newTransaction')).toBeInTheDocument();
  });

  it('should call onNewTransaction when button is clicked', () => {
    const mockOnNewTransaction = vi.fn();
    render(
      <TransactionActions 
        onNewTransaction={mockOnNewTransaction} 
        stripeReady={true}
      />
    );
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(mockOnNewTransaction).toHaveBeenCalledTimes(1);
  });

  it('should render Plus icon', () => {
    const mockOnNewTransaction = vi.fn();
    const { container } = render(
      <TransactionActions 
        onNewTransaction={mockOnNewTransaction} 
        stripeReady={true}
      />
    );
    
    // Check for Plus icon (lucide-react)
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
