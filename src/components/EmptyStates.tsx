/**
 * Empty state components for better UX when no data is available
 * Provides contextual messages and actions
 */

import { FileX, AlertCircle, CheckCircle, Inbox, Search } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="animate-fade-in">
          {action.label}
        </Button>
      )}
    </div>
  );
};

/**
 * Pre-built empty states for common scenarios
 */
export const EmptyStates = {
  NoTransactions: ({ onCreate }: { onCreate: () => void }) => (
    <EmptyState
      icon={<Inbox className="h-16 w-16" />}
      title="Aucune transaction"
      description="Créez votre première transaction sécurisée pour commencer à utiliser RivvLock."
      action={{
        label: "Créer une transaction",
        onClick: onCreate
      }}
    />
  ),
  
  NoDisputes: () => (
    <EmptyState
      icon={<CheckCircle className="h-16 w-16 text-success" />}
      title="Aucun litige"
      description="Toutes vos transactions se déroulent sans problème. C'est excellent !"
    />
  ),
  
  NoResults: ({ onClear }: { onClear?: () => void }) => (
    <EmptyState
      icon={<Search className="h-16 w-16" />}
      title="Aucun résultat"
      description="Essayez de modifier vos filtres de recherche."
      action={onClear ? {
        label: "Effacer les filtres",
        onClick: onClear
      } : undefined}
    />
  ),
  
  ErrorState: ({ onRetry }: { onRetry: () => void }) => (
    <EmptyState
      icon={<AlertCircle className="h-16 w-16 text-destructive" />}
      title="Erreur de chargement"
      description="Impossible de charger les données. Veuillez réessayer."
      action={{
        label: "Réessayer",
        onClick: onRetry
      }}
    />
  ),
  
  NoMessages: () => (
    <EmptyState
      icon={<Inbox className="h-12 w-12" />}
      title="Aucun message"
      description="La conversation commencera ici."
      className="py-8"
    />
  ),
  
  NoActivity: () => (
    <EmptyState
      icon={<FileX className="h-16 w-16" />}
      title="Aucune activité récente"
      description="Votre historique d'activité apparaîtra ici."
    />
  ),
};
