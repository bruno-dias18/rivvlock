/**
 * Barrel export file for components
 * Provides centralized imports for better organization and tree-shaking
 */

// Layout Components
export { DashboardLayout } from './DashboardLayout';
export { Footer } from './Footer';

// Auth & Routes
export { ProtectedRoute } from './ProtectedRoute';
export { AdminRoute } from './AdminRoute';

// Transaction Components
export { TransactionCard } from './TransactionCard';
export { default as CompleteTransactionButton } from './CompleteTransactionButton';
export { CompleteTransactionButtonWithStatus } from './CompleteTransactionButtonWithStatus';
export { TransactionMessaging } from './TransactionMessaging';
export { VirtualTransactionList } from './VirtualTransactionList';
export { CreateTransactionOrQuoteDialog } from './CreateTransactionOrQuoteDialog';
export { RenewTransactionDialog } from './RenewTransactionDialog';
export { ShareLinkDialog } from './ShareLinkDialog';
export { FeeDistributionSection } from './FeeDistributionSection';

// Dispute Components
export { DisputeCard } from './DisputeCard';
export { CreateDisputeDialog } from './CreateDisputeDialog';
export { CreateProposalDialog } from './CreateProposalDialog';
export { EscalatedDisputeMessaging } from './EscalatedDisputeMessaging';
export { UnifiedMessaging } from './UnifiedMessaging';

// Admin Components
export { AdminAnalyticsCharts } from './AdminAnalyticsCharts';
export { AdminAnalyticsKPIs } from './AdminAnalyticsKPIs';
export { AdminDisputeCard } from './AdminDisputeCard';
export { AdminDisputeMessaging } from './AdminDisputeMessaging';
export { AdminOfficialProposalCard } from './AdminOfficialProposalCard';
export { AdminOfficialProposalDialog } from './AdminOfficialProposalDialog';

// Payment & Validation
export { PaymentCountdown } from './PaymentCountdown';
export { ValidationCountdown } from './ValidationCountdown';
export { ValidationActionButtons } from './ValidationActionButtons';
export { PaymentTimingInfo } from './PaymentTimingInfo';
export { ExpiredPaymentNotification } from './ExpiredPaymentNotification';

// Date & Time
export { DateChangeRequestDialog } from './DateChangeRequestDialog';
export { DateChangeApprovalCard } from './DateChangeApprovalCard';
export { DateTimePicker } from './DateTimePicker';

// Profile & Settings
export { EditProfileDialog } from './EditProfileDialog';
export { DeleteAccountDialog } from './DeleteAccountDialog';
export { ChangePasswordDialog } from './ChangePasswordDialog';
export { ProfileAccessLogsCard } from './ProfileAccessLogsCard';
export { FAQSection } from './FAQSection';

// Stripe & Banking
export { BankAccountRequiredDialog } from './BankAccountRequiredDialog';
export { default as BankAccountSetupCard } from './BankAccountSetupCard';
export { EmbeddedStripeOnboarding } from './EmbeddedStripeOnboarding';
export { ValidateStripeAccountsButton } from './ValidateStripeAccountsButton';

// Navigation
export { AppSidebar } from './AppSidebar';
export { BottomTabBar } from './BottomTabBar';
export { UserMenu } from './UserMenu';
export { LanguageSelector } from './LanguageSelector';

// Utility Components
export { SortButtons } from './SortButtons';
export { RecentActivityCard } from './RecentActivityCard';
export { SellerTransactionsCountdownCard } from './SellerTransactionsCountdownCard';
export { CompleteTransactionConfirmDialog } from './CompleteTransactionConfirmDialog';

// Error Handling
export { GlobalErrorBoundary } from './GlobalErrorBoundary';
export { LocalErrorBoundary } from './LocalErrorBoundary';

// System Components
export { RealtimeActivitySync } from './RealtimeActivitySync';
export { ScrollToTop } from './ScrollToTop';
export { InstallPromptBanner } from './InstallPromptBanner';
