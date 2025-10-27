/**
 * Transaction status helpers for consistent UI display
 */

import type { TransactionStatus } from '@/types';

/**
 * Get badge variant for transaction status
 */
export function getStatusBadgeVariant(
  status: TransactionStatus
): 'default' | 'secondary' | 'destructive' | 'warning' {
  switch (status) {
    case 'pending':
    case 'pending_date_confirmation':
      return 'warning';
    case 'paid':
      return 'secondary';
    case 'validated':
      return 'default';
    case 'disputed':
      return 'destructive';
    case 'expired':
      return 'secondary';
    case 'refunded':
      return 'destructive'; // Rouge pour visibilité
    default:
      return 'default';
  }
}

/**
 * Get localized status label
 */
export function getStatusLabel(status: TransactionStatus, t: any): string {
  switch (status) {
    case 'pending':
      return t('transaction.status.pending', 'En attente');
    case 'paid':
      return t('transaction.status.paid', 'Payée');
    case 'validated':
      return t('transaction.status.validated', 'Validée');
    case 'disputed':
      return t('transaction.status.disputed', 'Litige');
    case 'expired':
      return t('transaction.status.expired', 'Expirée');
    case 'refunded':
      return t('transaction.status.refunded', 'Remboursée');
    default:
      return status;
  }
}
