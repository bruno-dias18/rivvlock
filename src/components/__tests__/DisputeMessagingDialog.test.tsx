import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { DisputeMessagingDialog } from '../DisputeMessagingDialog';

// Mock hooks
vi.mock('@/hooks/useDisputeMessages', () => ({
  useDisputeMessages: () => ({
    messages: [],
    isLoading: false,
    sendMessage: vi.fn(),
    isSendingMessage: false,
  }),
}));

vi.mock('@/hooks/useDisputeProposals', () => ({
  useDisputeProposals: () => ({
    proposals: [],
    isLoading: false,
  }),
}));

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

vi.mock('@/hooks/useUnreadDisputesGlobal', () => ({
  useUnreadDisputesGlobal: () => ({
    unreadCount: 0,
    markAllAsSeen: vi.fn(),
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

const mockDispute = {
  id: 'dispute-1',
  transaction_id: 'transaction-1',
  reporter_id: 'test-user-id',
  status: 'open' as const,
  dispute_type: 'quality_issue',
  reason: 'Test dispute reason',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  archived_by_buyer: false,
  archived_by_seller: false,
};

describe('DisputeMessagingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    render(
      <DisputeMessagingDialog
        disputeId={mockDispute.id}
        status="open"
        transactionAmount={100}
        currency="EUR"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    // Should render the dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      <DisputeMessagingDialog
        disputeId={mockDispute.id}
        status="open"
        transactionAmount={100}
        currency="EUR"
        open={false}
        onOpenChange={vi.fn()}
      />
    );

    // Dialog content should not be visible
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('should have correct disputeId prop', () => {
    const { rerender } = render(
      <DisputeMessagingDialog
        disputeId={mockDispute.id}
        status="open"
        transactionAmount={100}
        currency="EUR"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Test with different disputeId
    rerender(
      <DisputeMessagingDialog
        disputeId="different-dispute-id"
        status="open"
        transactionAmount={100}
        currency="EUR"
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
