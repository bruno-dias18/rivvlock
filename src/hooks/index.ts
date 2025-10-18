/**
 * Barrel export file for custom hooks
 * Provides centralized imports for better organization
 */

// Transaction Hooks
export { useTransactions, useSyncStripePayments } from './useTransactions';
export { useTransactionsWithNewActivity } from './useTransactionsWithNewActivity';
export { useHasTransactionMessages } from './useHasTransactionMessages';
export { useValidationStatus } from './useValidationStatus';
export { useAnnualTransactions } from './useAnnualTransactions';
export { usePaginatedTransactions } from './usePaginatedTransactions';

// Dispute Hooks
export { useDisputes } from './useDisputes';
export { useDisputeProposals } from './useDisputeProposals';
export { useUnreadDisputesGlobal } from './useUnreadDisputesGlobal';
export { useDisputeRealtimeNotifications } from './useDisputeRealtimeNotifications';
export { useEscalatedDisputeMessaging } from './useEscalatedDisputeMessaging';
export { useDisputeMessageReads } from './useDisputeMessageReads';

// Admin Hooks
export { useAdminTransactions } from './useAdminTransactions';
export { useAdminDisputes } from './useAdminDisputes';
export { useAdminUsers } from './useAdminUsers';
export { useAdminStats } from './useAdminStats';
export { useAdminAnalytics } from './useAdminAnalytics';
export { useAdminActivityLogs } from './useAdminActivityLogs';
export { useAdminDisputeMessaging } from './useAdminDisputeMessaging';
export { useAdminDisputeNotifications } from './useAdminDisputeNotifications';
export { useUnreadAdminMessages } from './useUnreadAdminMessages';
export { useUnreadDisputeAdminMessages } from './useUnreadDisputeAdminMessages';
export { useIsAdmin } from './useIsAdmin';

// User & Profile Hooks
export { useProfile } from './useProfile';
export { useProfileAccessLogs } from './useProfileAccessLogs';

// Stripe Hooks
export { useStripeAccount } from './useStripeAccount';
export { useSellerStripeStatus } from './useSellerStripeStatus';

// Activity & Notifications
export { useActivityHistory } from './useActivityHistory';
export { useRecentActivity } from './useRecentActivity';
export { useNewItemsNotifications } from './useNewItemsNotifications';
export { useRealtimeActivityRefresh } from './useRealtimeActivityRefresh';
export { useAutoSync } from './useAutoSync';

// PWA & Install
export { useInstallPrompt } from './useInstallPrompt';

// Quote Hooks
export { useQuotes } from './useQuotes';
export { useUnreadQuoteTabCounts } from './useUnreadQuoteTabCounts';
export { useAttachQuote } from './useAttachQuote';

// Unified Conversation Hooks
export { useConversation } from './useConversation';
export { useUnreadConversationMessages } from './useUnreadConversationMessages';
export { useMarkConversationAsRead } from './useMarkConversationAsRead';
export { useUnreadQuotesGlobal } from './useUnreadQuotesGlobal';
export { useUnreadTransactionsGlobal } from './useUnreadTransactionsGlobal';
export { useUnreadTransactionTabCounts } from './useUnreadTransactionTabCounts';

// Utility Hooks
export { useDebounce, useDebouncedCallback } from './useDebounce';
