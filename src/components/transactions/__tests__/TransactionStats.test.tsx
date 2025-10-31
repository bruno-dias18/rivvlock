import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionStats } from '../TransactionStats';
import type { Transaction } from '@/types';

const createMockTransaction = (id: string, status: any, price: number): Transaction => ({
  id,
  status,
  user_id: 'u1',
  buyer_id: null,
  price,
  currency: 'eur',
  title: `Test ${id}`,
  description: '',
  service_date: null,
  service_end_date: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  payment_deadline: null,
  payment_deadline_card: null,
  payment_deadline_bank: null,
  validation_deadline: null,
  funds_released_at: null,
  seller_validated_at: null,
  buyer_validated_at: null,
  shared_link_token: null,
  shared_link_expires_at: null,
  payment_method: undefined,
  stripe_payment_intent_id: null,
  stripe_transfer_id: null,
  payment_reference: null,
  refund_status: null,
  refund_percentage: null,
  date_change_status: null,
  requested_service_date: null,
  date_change_message: null,
  renewal_count: 0,
  conversation_id: null,
});

const mockTransactions: Transaction[] = [
  createMockTransaction('1', 'pending', 100),
  createMockTransaction('2', 'pending', 200),
  createMockTransaction('3', 'paid', 300),
  createMockTransaction('4', 'validated', 400),
  createMockTransaction('5', 'disputed', 500),
];

describe('TransactionStats', () => {
  it('should render all stat cards', () => {
    render(<TransactionStats transactions={mockTransactions} />);
    
    expect(screen.getByText('transactions.pending')).toBeInTheDocument();
    expect(screen.getByText('transactions.blocked')).toBeInTheDocument();
    expect(screen.getByText('transactions.completed')).toBeInTheDocument();
    expect(screen.getByText('transactions.disputed')).toBeInTheDocument();
  });

  it('should display correct counts', () => {
    render(<TransactionStats transactions={mockTransactions} />);
    
    // Find all elements with text "2" (pending count)
    const pendingCount = screen.getAllByText('2')[0];
    expect(pendingCount).toBeInTheDocument();
    
    // Check other counts (at least one "1" should appear)
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // blocked, completed, disputed
  });

  it('should handle empty transactions array', () => {
    render(<TransactionStats transactions={[]} />);
    
    // All counts should be 0
    const zeroCounts = screen.getAllByText('0');
    expect(zeroCounts).toHaveLength(4);
  });

  it('should render icons for each stat card', () => {
    const { container } = render(<TransactionStats transactions={mockTransactions} />);
    
    // Check that icons are rendered (lucide-react icons have specific classes)
    const icons = container.querySelectorAll('svg');
    expect(icons.length).toBeGreaterThanOrEqual(4);
  });
});
