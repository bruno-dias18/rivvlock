import { useCallback } from 'react';
import { ProposalItem } from '@/components/CreateProposalDialog/types';
import { FEES } from '@/lib/constants';
import { toast } from 'sonner';

/**
 * Hook pour gérer les items d'une proposition
 * 
 * Fournit des fonctions optimisées (useCallback) pour :
 * - Ajouter/supprimer/modifier des items
 * - Appliquer la répartition automatique des frais
 * 
 * @param items - Items actuels
 * @param setItems - Setter pour mettre à jour les items
 * @param baseItems - Items de base (snapshot avant répartition)
 * @param feeRatio - Ratio de frais à la charge du client
 * @param setAutoDistributionApplied - Setter pour l'état de répartition
 */
export const useProposalItems = (
  items: ProposalItem[],
  setItems: React.Dispatch<React.SetStateAction<ProposalItem[]>>,
  baseItems: ProposalItem[],
  feeRatio: number,
  setAutoDistributionApplied: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const addItem = useCallback(() => {
    const newItem: ProposalItem = {
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    };
    setItems((prev) => [...prev, newItem]);
    setAutoDistributionApplied(false);
  }, [setItems, setAutoDistributionApplied]);

  const removeItem = useCallback(
    (index: number) => {
      if (items.length === 1) return;
      setItems((prev) => prev.filter((_, i) => i !== index));
      setAutoDistributionApplied(false);
    },
    [items.length, setItems, setAutoDistributionApplied]
  );

  const updateItem = useCallback(
    (index: number, field: keyof ProposalItem, value: any) => {
      setItems((prev) => {
        const newItems = [...prev];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'quantity' || field === 'unit_price') {
          newItems[index].total =
            newItems[index].quantity * newItems[index].unit_price;
        }

        return newItems;
      });
      setAutoDistributionApplied(false);
    },
    [setItems, setAutoDistributionApplied]
  );

  const applyAutoDistribution = useCallback(() => {
    if (feeRatio === 0 || baseItems.length === 0) {
      toast.info('Aucune répartition à appliquer (frais client à 0%)');
      return;
    }

    const baseTotal = baseItems.reduce((sum, item) => sum + item.total, 0);
    if (baseTotal === 0) {
      toast.info('Aucun montant à répartir');
      return;
    }

    const totalFees = baseTotal * FEES.RIVVLOCK_FEE_RATE;
    const clientFees = totalFees * (feeRatio / 100);
    const finalPrice = baseTotal + clientFees;
    const ratio = finalPrice / baseTotal;

    const adjustedItems = baseItems.map((item) => ({
      ...item,
      unit_price: item.unit_price * ratio,
      total: item.quantity * (item.unit_price * ratio),
    }));

    setItems(adjustedItems);
    setAutoDistributionApplied(true);
    toast.success('Frais répartis automatiquement sur toutes les lignes');
  }, [baseItems, feeRatio, setItems, setAutoDistributionApplied]);

  return { addItem, removeItem, updateItem, applyAutoDistribution };
};
