import { useMemo } from 'react';

export type ValidationPhase = 
  | 'pending'           // En attente de paiement
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

    const now = new Date();
    const serviceDate = transaction.service_date ? new Date(transaction.service_date) : null;
    const validationDeadline = transaction.validation_deadline ? new Date(transaction.validation_deadline) : null;
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

    // Pending payment
    if (transaction.status === 'pending') {
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

      // Paid but no validation deadline yet (seller hasn't validated)
      return {
        phase: 'service_pending',
        isValidationDeadlineActive: false,
        canFinalize: false,
        canDispute: false,
        canManuallyFinalize: isUserBuyer,
        displayLabel: transaction.seller_validated ? 'Service terminé' : 'En attente validation vendeur',
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