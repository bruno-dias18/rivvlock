import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { DisputeCard } from '../DisputeCard';
import type { Dispute } from '@/types';

// Mock hooks
vi.mock('@/hooks/useUnreadDisputeMessages', () => ({
  useUnreadDisputeMessages: () => ({
    unreadCount: 0,
    markAsSeen: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useUnreadDisputeAdminMessages', () => ({
  useUnreadDisputeAdminMessages: () => ({
    unreadCount: 0,
    markAsSeen: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDisputeMessageReads', () => ({
  useDisputeMessageReads: () => ({
    markDisputeAsSeen: vi.fn(),
    isMarking: false,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

const mockDispute: Dispute = {
  id: 'dispute-1',
  transaction_id: 'transaction-1',
  reporter_id: 'test-user-id',
  status: 'open',
  dispute_type: 'quality_issue',
  reason: 'Test dispute reason',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived_by_buyer: false,
  archived_by_seller: false,
  resolution: null,
  dispute_deadline: null,
  escalated_at: null,
  resolved_at: null,
  buyer_archived_at: null,
  seller_archived_at: null,
};

describe('DisputeCard', () => {
  it('should render dispute information', () => {
    render(<DisputeCard dispute={mockDispute} />);

    expect(screen.getByText(/quality_issue/i)).toBeInTheDocument();
    expect(screen.getByText(/Test dispute reason/i)).toBeInTheDocument();
  });

  it('should display dispute status', () => {
    render(<DisputeCard dispute={mockDispute} />);

    expect(screen.getByText(/open/i)).toBeInTheDocument();
  });

  it('should render action buttons', () => {
    render(<DisputeCard dispute={mockDispute} />);

    // Should have message button
    const messageButton = screen.getByRole('button', { name: /message/i });
    expect(messageButton).toBeInTheDocument();
  });

  it('should display resolved status for resolved disputes', () => {
    const resolvedDispute = {
      ...mockDispute,
      status: 'resolved_refund' as const,
      resolved_at: new Date().toISOString(),
    };

    render(<DisputeCard dispute={resolvedDispute} />);

    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
  });

  it('should show responded status when dispute is responded', () => {
    const respondedDispute = {
      ...mockDispute,
      status: 'responded' as const,
    };

    render(<DisputeCard dispute={respondedDispute} />);

    expect(screen.getByText(/responded/i)).toBeInTheDocument();
  });

  it('should display created date', () => {
    render(<DisputeCard dispute={mockDispute} />);

    // Should have a date element
    const dateText = screen.getByText(/created/i);
    expect(dateText).toBeInTheDocument();
  });
});
