/**
 * Refund Calculator Utility
 * 
 * Centralise la logique de calcul des remboursements pour éviter duplication
 * et garantir la cohérence entre UI et Backend.
 * 
 * Règle RivvLock:
 * 1. Déduire d'ABORD les frais plateforme (5%)
 * 2. Partager ENSUITE le montant restant selon refund_percentage
 * 
 * Exemple: 123 CHF, refund 50%
 * - Frais: 123 * 5% = 6.15 CHF
 * - Base: 123 - 6.15 = 116.85 CHF
 * - Acheteur paie: 116.85 * 50% = 58.42 CHF
 * - Vendeur reçoit: 116.85 * 50% = 58.42 CHF
 * - Total: 58.42 + 58.42 + 6.15 = 123 CHF ✅
 */

export interface RefundCalculation {
  /** Montant remboursé à l'acheteur (en cents) */
  refundAmount: number;
  /** Montant transféré au vendeur (en cents) */
  sellerAmount: number;
  /** Frais RivvLock (en cents) */
  platformFee: number;
  /** Montant de base avant partage (en cents) */
  baseCents: number;
}

/**
 * Calcule les montants pour un remboursement partiel ou total
 * 
 * @param totalAmount - Montant total de la transaction (en cents)
 * @param refundPercentage - Pourcentage de remboursement (0-100)
 * @param platformFeeRate - Taux de frais plateforme (défaut: 0.05 = 5%)
 * @returns RefundCalculation avec tous les montants calculés
 * 
 * @example
 * // Remboursement 50% sur 123 CHF (12300 cents)
 * const result = calculateRefund(12300, 50);
 * // result.refundAmount = 5842 (58.42 CHF)
 * // result.sellerAmount = 5842 (58.42 CHF)
 * // result.platformFee = 615 (6.15 CHF)
 */
export function calculateRefund(
  totalAmount: number,
  refundPercentage: number,
  platformFeeRate: number = 0.05
): RefundCalculation {
  // Validation
  if (totalAmount < 0) {
    throw new Error(`Invalid totalAmount: ${totalAmount} (must be >= 0)`);
  }
  if (refundPercentage < 0 || refundPercentage > 100) {
    throw new Error(`Invalid refundPercentage: ${refundPercentage} (must be 0-100)`);
  }

  // 1. Calculer les frais plateforme
  const platformFee = Math.round(totalAmount * platformFeeRate);
  
  // 2. Calculer le montant de base (après déduction des frais)
  const baseCents = totalAmount - platformFee;
  
  // 3. Calculer le montant remboursé (part acheteur)
  const refundAmount = Math.round(baseCents * refundPercentage / 100);
  
  // 4. Calculer le montant vendeur (base - refund)
  const sellerAmount = baseCents - refundAmount;

  return {
    refundAmount,
    sellerAmount,
    platformFee,
    baseCents
  };
}

/**
 * Valide qu'un remboursement est cohérent
 * 
 * @param calculation - Résultat de calculateRefund()
 * @param totalAmount - Montant total original
 * @returns true si la somme est correcte
 */
export function validateRefundCalculation(
  calculation: RefundCalculation,
  totalAmount: number
): boolean {
  const sum = calculation.refundAmount + calculation.sellerAmount + calculation.platformFee;
  return sum === totalAmount;
}
