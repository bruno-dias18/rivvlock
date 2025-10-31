import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { Transaction } from '@/types';

const mockTransaction: Partial<Transaction> = {
  id: 'test-123',
  title: 'Test Transaction',
  price: 100,
  currency: 'eur',
  status: 'pending',
  payment_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
};

describe('PaymentMethodSelector', () => {
  it('should render both payment method options', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    expect(screen.getByText(/carte bancaire/i)).toBeInTheDocument();
    expect(screen.getByText(/virement bancaire/i)).toBeInTheDocument();
  });

  it('should call onMethodSelect when card option is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const cardOption = screen.getByLabelText(/carte bancaire/i);
    fireEvent.click(cardOption);

    expect(mockOnMethodSelect).toHaveBeenCalledWith('card');
  });

  it('should call onMethodSelect when bank transfer option is clicked', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="bank_transfer"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const bankOption = screen.getByLabelText(/virement bancaire/i);
    fireEvent.click(bankOption);

    expect(mockOnMethodSelect).toHaveBeenCalledWith('bank_transfer');
  });

  it('should display transaction amount', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    expect(screen.getByText(/100 EUR/i)).toBeInTheDocument();
  });

  it('should disable bank transfer when deadline is expired', () => {
    const expiredDeadlineTransaction: Partial<Transaction> = {
      ...mockTransaction,
      payment_deadline_bank: new Date(Date.now() - 1000).toISOString(), // expired
      payment_deadline_card: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={expiredDeadlineTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const bankOption = screen.getByLabelText(/virement bancaire/i);
    expect(bankOption).toBeDisabled();
    expect(screen.getByText(/Expiré/)).toBeInTheDocument();
  });

  it('should allow bank transfer when deadline is sufficient', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const bankOption = screen.getByLabelText(/virement bancaire/i);
    expect(bankOption).not.toBeDisabled();
    expect(screen.getByText(/⭐ Recommandé/)).toBeInTheDocument();
  });

  it('should display payment deadline information', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    // Check for time remaining display
    expect(screen.getByText(/jours restants/i)).toBeInTheDocument();
  });

  it('should display savings message for bank transfer', () => {
    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={mockTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    // Check for savings message (2.9% + 0.30 of 100 = 3.20)
    expect(screen.getByText(/Économisez 3\.20 EUR en frais/i)).toBeInTheDocument();
    expect(screen.getByText(/⭐ Recommandé/)).toBeInTheDocument();
  });
});
