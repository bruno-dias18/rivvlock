import { useMemo } from 'react';
import { ProposalItem } from '@/components/CreateProposalDialog/types';
import { FEES } from '@/lib/constants';
import { useProfile } from '@/hooks/useProfile';

/**
 * Hook pour calculer tous les montants d'une proposition (devis ou transaction)
 * 
 * Optimisé avec useMemo pour éviter les recalculs inutiles
 * 
 * @param baseItems - Items de base (snapshot immutable avant répartition des frais)
 * @param feeRatio - Ratio de frais à la charge du client (0-100)
 * @returns Tous les calculs financiers (HT, TTC, frais, etc.)
 */
export const useProposalCalculations = (
  baseItems: ProposalItem[],
  feeRatio: number
) => {
  const { data: profile } = useProfile();

  return useMemo(() => {
    const baseTotal = baseItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
    const subtotal = baseTotal;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    const totalFees = totalAmount * FEES.RIVVLOCK_FEE_RATE;
    const clientFees = totalFees * (feeRatio / 100);
    const sellerFees = totalFees - clientFees;
    const finalPrice = totalAmount + clientFees;

    return {
      baseTotal,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      totalFees,
      clientFees,
      sellerFees,
      finalPrice,
    };
  }, [baseItems, feeRatio, profile]);
};
