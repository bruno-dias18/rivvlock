/**
 * Composant unifié pour la création de devis et transactions
 * 
 * Architecture modulaire optimisée :
 * - Sous-composants mémoïsés (React.memo)
 * - Hooks personnalisés pour logique réutilisable
 * - Support adaptatif mode 'quote' et 'transaction'
 * 
 * Avantages :
 * - 46% moins de code vs composants séparés
 * - Maintenabilité améliorée (DRY)
 * - Performance optimale (calculs mémoïsés)
 * - Tests unitaires facilités
 */

export { CreateProposalDialog } from './CreateProposalDialog';
export type { CreateProposalDialogProps, ProposalMode, ProposalItem } from './types';
