import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEscalatedDisputeConversations } from '@/hooks/useEscalatedDisputeConversations';
import { UnifiedMessaging } from '@/components/UnifiedMessaging';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { useIsMobile } from '@/lib/mobileUtils';
import { logger } from '@/lib/logger';

interface EscalatedDisputeMessagingProps {
  disputeId: string;
  transactionId: string;
  status: string;
  onClose: () => void;
}

export const EscalatedDisputeMessaging = ({ 
  disputeId, 
  transactionId, 
  status,
  onClose
}: EscalatedDisputeMessagingProps) => {
  const { t } = useTranslation();
  
  const { 
    conversationId,
    isSeller,
    isReady,
    isLoading
  } = useEscalatedDisputeConversations({ disputeId, transactionId });

  const isResolved = status === 'resolved' || status === 'resolved_refund' || status === 'resolved_release';

  if (isLoading || !isReady) {
    return (
      <>
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {t('Communication privée avec l\'administration')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">
              {t('Initialisation de la conversation privée...')}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!conversationId) {
    return (
      <>
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="text-lg">
            {t('Communication privée avec l\'administration')}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex items-center justify-center p-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('Aucune conversation privée n\'a encore été créée. L\'administration doit d\'abord escalader ce litige.')}
            </AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
        <DialogTitle className="text-lg">
          {t('Communication privée avec l\'administration')}
        </DialogTitle>
        <Alert className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {isSeller 
              ? t('Vous communiquez en privé avec l\'administration. L\'acheteur ne voit pas ces messages.')
              : t('Vous communiquez en privé avec l\'administration. Le vendeur ne voit pas ces messages.')
            }
          </AlertDescription>
        </Alert>
      </DialogHeader>

      <UnifiedMessaging
        conversationId={conversationId}
        open={true}
        onOpenChange={onClose}
        otherParticipantName={t('Administration')}
        title="" // Titre déjà affiché dans le header
        inline={true} // Évite la double Dialog
      />

      {isResolved && (
        <div className="px-6 py-4 border-t bg-background shrink-0">
          <Alert>
            <AlertDescription>
              {t('Ce litige est résolu. La messagerie est fermée.')}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </>
  );
};
