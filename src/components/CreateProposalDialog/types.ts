import { Currency } from '@/types';

/**
 * Mode du composant CreateProposalDialog
 * - 'quote' : Création d'un devis
 * - 'transaction' : Création d'une transaction directe
 */
export type ProposalMode = 'quote' | 'transaction' as const;

/**
 * Structure d'un item de proposition (devis ou transaction)
 * Compatible avec le backend (snake_case pour unit_price)
 */
export interface ProposalItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number; // snake_case pour compatibilité backend
  total: number;
}

/**
 * Props du composant CreateProposalDialog
 */
export interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  mode: ProposalMode;
}

/**
 * État complet du formulaire de proposition
 */
export interface ProposalFormState {
  clientEmail: string;
  clientName: string;
  title: string;
  description: string;
  currency: Currency;
  serviceDate?: Date;
  serviceTime?: string; // Mode transaction uniquement
  serviceEndDate?: Date;
  validUntil?: Date; // Mode quote uniquement
  items: ProposalItem[];
  feeRatio: number; // 0-100
}
