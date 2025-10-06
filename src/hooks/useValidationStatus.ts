import { useMemo } from 'react';

export type ValidationPhase = 
  | 'pending'                  // En attente de paiement
  | 'expired'                  // Délai de paiement expiré
  | 'service_pending'          // Service pas encore rendu (paid mais service futur)
  | 'validation_active'        // En phase de validation acheteur (48h countdown)
  | 'validation_expired'       // Délai de validation expiré
  | 'completed'                // Terminé/validé
  | 'disputed';                // En litige

interface ValidationStatus {
  phase: ValidationPhase;
  timeRemaining?: number; // en millisecondes
  isValidationDeadlineActive: boolean;
  canFinalize: boolean;
  canDispute: boolean;
  canManuallyFinalize: boolean;
  displayLabel: string;
  displayColor: 'default' | 'secondary' | 'destructive';
}

export function useValidationStatus(transaction: any, userId?: string): ValidationStatus {
  return useMemo(() => {
    if (!transaction || !userId) {
      return {
        phase: 'pending',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'En attente',
        displayColor: 'default'
      };
    }

    // Check for pending date change first
    if (transaction.date_change_status === 'pending_approval') {
      return {
        phase: 'pending',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'Modification de date en attente',
        displayColor: 'secondary'
      };
    }

    const now = new Date();
    const serviceDate = transaction.service_end_date 
      ? new Date(transaction.service_end_date) 
      : (transaction.service_date ? new Date(transaction.service_date) : null);
    const validationDeadline = transaction.validation_deadline ? new Date(transaction.validation_deadline) : null;
    const sellerValidationDeadline = transaction.seller_validation_deadline ? new Date(transaction.seller_validation_deadline) : null;
    const isUserBuyer = transaction.buyer_id === userId;
    const isUserSeller = transaction.user_id === userId;

    // Disputed status
    if (transaction.status === 'disputed') {
      return {
        phase: 'disputed',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'En litige',
        displayColor: 'destructive'
      };
    }

    // Completed/validated status
    if (transaction.status === 'validated') {
      return {
        phase: 'completed',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'Terminé',
        displayColor: 'default'
      };
    }

    // Expired payment deadline
    if (transaction.status === 'expired') {
      return {
        phase: 'expired',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'Délai de paiement expiré',
        displayColor: 'destructive'
      };
    }

    // Pending payment
    if (transaction.status === 'pending') {
      // Check if payment deadline has passed (for real-time detection)
      const paymentDeadline = transaction.payment_deadline ? new Date(transaction.payment_deadline) : null;
      const updatedAt = transaction.updated_at ? new Date(transaction.updated_at) : null;
      // Grace period: if transaction was recently reactivated via date change approval,
      // don't mark as expired immediately even if deadline seems past
      const recentlyReactivated = (
        transaction.date_change_status === 'approved' &&
        !!updatedAt && (now.getTime() - updatedAt.getTime()) <= (2 * 60 * 60 * 1000) // 2 hours
      );

      if (paymentDeadline && paymentDeadline <= now && !recentlyReactivated) {
        return {
          phase: 'expired',
          isValidationDeadlineActive: false,
          canFinalize: false,
          canDispute: false,
          canManuallyFinalize: false,
          displayLabel: 'Délai de paiement expiré',
          displayColor: 'destructive'
        };
      }
      
      return {
        phase: 'pending',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'En attente de paiement',
        displayColor: 'secondary'
      };
    }

    // Paid status - need to determine which sub-phase
    if (transaction.status === 'paid') {
      // Service not yet rendered (service date in future)
      if (serviceDate && serviceDate > now) {
        return {
          phase: 'service_pending',
          isValidationDeadlineActive: false,
          canFinalize: isUserBuyer,
          canDispute: isUserBuyer,
          canManuallyFinalize: false,
          displayLabel: 'Service en cours',
          displayColor: 'default'
        };
      }

      // Check if validation deadline is active
      if (validationDeadline) {
        const timeRemaining = validationDeadline.getTime() - now.getTime();
        
        if (timeRemaining <= 0) {
          // Validation deadline expired
          return {
            phase: 'validation_expired',
            timeRemaining: 0,
            isValidationDeadlineActive: false,
            canFinalize: false,
            canDispute: false,
            canManuallyFinalize: false,
            displayLabel: 'Finalisation automatique',
            displayColor: 'secondary'
          };
        } else {
          // Validation deadline active
          return {
            phase: 'validation_active',
            timeRemaining,
            isValidationDeadlineActive: true,
            canFinalize: isUserBuyer,
            canDispute: isUserBuyer,
            canManuallyFinalize: false,
            displayLabel: 'Validation en cours',
            displayColor: 'secondary'
          };
        }
      }

      // Paid but no validation deadline yet (service date not passed)
      return {
        phase: 'service_pending',
        isValidationDeadlineActive: false,
        canFinalize: isUserBuyer,
        canDispute: isUserBuyer,
        canManuallyFinalize: false,
        displayLabel: 'Service terminé',
        displayColor: 'default'
      };
    }

    // Default fallback
    return {
      phase: 'pending',
      isValidationDeadlineActive: false,
      canFinalize: false,
      canDispute: false,
      canManuallyFinalize: false,
      displayLabel: 'Statut inconnu',
      displayColor: 'default'
    };
  }, [transaction, userId]);
}