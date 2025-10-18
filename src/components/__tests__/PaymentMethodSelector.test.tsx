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

  it('should disable bank transfer when deadline is too short', () => {
    const shortDeadlineTransaction: Partial<Transaction> = {
      ...mockTransaction,
      payment_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    };

    const mockOnMethodSelect = vi.fn();
    render(
      <PaymentMethodSelector
        transaction={shortDeadlineTransaction as Transaction}
        selectedMethod="card"
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const bankOption = screen.getByLabelText(/virement bancaire/i);
    expect(bankOption).toBeDisabled();
    expect(screen.getByText(/non disponible/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/non disponible/i)).not.toBeInTheDocument();
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

    expect(screen.getByText(/paiement requis avant/i)).toBeInTheDocument();
  });
});
