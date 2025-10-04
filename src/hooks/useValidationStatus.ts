import { useMemo } from 'react';

export type ValidationPhase = 
  | 'pending'           // En attente de paiement
  | 'expired'           // Délai de paiement expiré
  | 'service_pending'   // Service pas encore rendu (paid mais service futur)
  | 'validation_active' // En phase de validation (48h countdown)
  | 'validation_expired'// Délai de validation expiré
  | 'completed'         // Terminé/validé
  | 'disputed';         // En litige

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
    console.debug('🔍 useValidationStatus called:', {
      transactionId: transaction?.id,
      transactionTitle: transaction?.title,
      userId,
      buyerId: transaction?.buyer_id,
      sellerId: transaction?.user_id,
      status: transaction?.status,
      sellerValidated: transaction?.seller_validated,
      buyerValidated: transaction?.buyer_validated,
      validationDeadline: transaction?.validation_deadline,
      serviceDate: transaction?.service_date,
      serviceEndDate: transaction?.service_end_date
    });

    if (!transaction || !userId) {
      console.debug('⚠️ Missing transaction or userId');
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
    const isUserBuyer = transaction.buyer_id === userId;
    const isUserSeller = transaction.user_id === userId;

    console.debug('🔍 Computed values:', {
      isUserBuyer,
      isUserSeller,
      serviceDateInFuture: serviceDate ? serviceDate > now : 'no service date',
      validationDeadlineExists: !!validationDeadline,
      validationDeadlineInFuture: validationDeadline ? validationDeadline > now : 'no deadline'
    });

    // Disputed status
    if (transaction.status === 'disputed') {
      const result = {
        phase: 'disputed' as ValidationPhase,
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: false,
        displayLabel: 'En litige',
        displayColor: 'destructive' as const
      };
      console.debug('✅ Returning result (disputed):', result);
      return result;
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
          canFinalize: false,
          canDispute: false,
          canManuallyFinalize: isUserBuyer,
          displayLabel: 'Service en cours',
          displayColor: 'default'
        };
      }

      // Check if validation deadline is active
      if (validationDeadline) {
        const timeRemaining = validationDeadline.getTime() - now.getTime();
        
        if (timeRemaining <= 0) {
          // Validation deadline expired
          const result = {
            phase: 'validation_expired' as ValidationPhase,
            timeRemaining: 0,
            isValidationDeadlineActive: false,
            canFinalize: false,
            canDispute: false,
            canManuallyFinalize: false,
            displayLabel: 'Finalisation automatique',
            displayColor: 'secondary' as const
          };
          console.debug('✅ Returning result (validation_expired):', result);
          return result;
        } else {
          // Validation deadline active
          const result = {
            phase: 'validation_active' as ValidationPhase,
            timeRemaining,
            isValidationDeadlineActive: true,
            canFinalize: isUserBuyer,
            canDispute: isUserBuyer,
            canManuallyFinalize: false,
            displayLabel: 'Validation en cours',
            displayColor: 'secondary' as const
          };
          console.debug('✅ Returning result (validation_active):', result);
          return result;
        }
      }

      // Paid but no validation deadline yet (seller hasn't validated)
      const result = {
        phase: 'service_pending' as ValidationPhase,
        isValidationDeadlineActive: false,
        canFinalize: transaction.seller_validated && isUserBuyer,
        canDispute: transaction.seller_validated && isUserBuyer,
        canManuallyFinalize: isUserBuyer,
        displayLabel: transaction.seller_validated ? 'Service terminé' : 'En attente validation vendeur',
        displayColor: 'default' as const
      };
      console.debug('✅ Returning result (service_pending):', result);
      return result;
    }

    // Default fallback
    const result = {
      phase: 'pending' as ValidationPhase,
      isValidationDeadlineActive: false,
      canFinalize: false,
      canDispute: false,
      canManuallyFinalize: false,
      displayLabel: 'Statut inconnu',
      displayColor: 'default' as const
    };
    console.debug('✅ Returning result (default fallback):', result);
    return result;
  }, [transaction, userId]);
}