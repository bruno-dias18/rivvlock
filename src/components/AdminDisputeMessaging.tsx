import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, AlertCircle } from 'lucide-react';
import { useAdminDisputeConversations } from '@/hooks/useAdminDisputeConversations';
import { UnifiedMessaging } from '@/components/UnifiedMessaging';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useUnreadConversationMessages } from '@/hooks/useUnreadConversationMessages';

interface AdminDisputeMessagingProps {
  disputeId: string;
  sellerId: string;
  buyerId: string;
  sellerName: string;
  buyerName: string;
  status: string;
}

export const AdminDisputeMessaging = ({
  disputeId,
  sellerId,
  buyerId,
  sellerName,
  buyerName,
  status
}: AdminDisputeMessagingProps) => {
  const [sellerDialogOpen, setSellerDialogOpen] = useState(false);
  const [buyerDialogOpen, setBuyerDialogOpen] = useState(false);
  
  const { 
    sellerConversationId,
    buyerConversationId,
    isReady,
    isLoading,
    createConversations,
    isCreating
  } = useAdminDisputeConversations({ disputeId, sellerId, buyerId });

  const isResolved = status.startsWith('resolved');
  
  // Compteurs de messages non lus
  const { unreadCount: sellerUnreadCount } = useUnreadConversationMessages(sellerConversationId);
  const { unreadCount: buyerUnreadCount } = useUnreadConversationMessages(buyerConversationId);

  useEffect(() => {
    // Créer automatiquement les conversations si elles n'existent pas
    if (!isLoading && !isReady && !isCreating) {
      createConversations().catch((error) => {
        console.error('Error creating conversations:', error);
        toast.error("Erreur lors de la création des conversations");
      });
    }
  }, [isLoading, isReady, isCreating, createConversations]);

  if (isLoading || isCreating) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">
            Initialisation des conversations privées...
          </p>
        </div>
      </div>
    );
  }

  if (!isReady || !sellerConversationId || !buyerConversationId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Les conversations privées n'ont pas pu être créées. Veuillez réessayer.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversation avec le vendeur */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Conversation avec le vendeur
              <Badge variant="outline" className="ml-auto">{sellerName}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setSellerDialogOpen(true)}
              className="w-full relative"
              disabled={isResolved}
            >
              Ouvrir la conversation
              {sellerUnreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {sellerUnreadCount}
                </Badge>
              )}
            </Button>
            {isResolved && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Litige résolu - lecture seule
              </p>
            )}
          </CardContent>
        </Card>

        {/* Conversation avec l'acheteur */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Conversation avec l'acheteur
              <Badge variant="outline" className="ml-auto">{buyerName}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setBuyerDialogOpen(true)}
              className="w-full relative"
              disabled={isResolved}
            >
              Ouvrir la conversation
              {buyerUnreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {buyerUnreadCount}
                </Badge>
              )}
            </Button>
            {isResolved && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Litige résolu - lecture seule
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog pour conversation avec vendeur */}
      <Dialog open={sellerDialogOpen} onOpenChange={setSellerDialogOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <UnifiedMessaging
            conversationId={sellerConversationId}
            open={sellerDialogOpen}
            onOpenChange={setSellerDialogOpen}
            otherParticipantName={sellerName}
            title={`Conversation avec ${sellerName} (vendeur)`}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog pour conversation avec acheteur */}
      <Dialog open={buyerDialogOpen} onOpenChange={setBuyerDialogOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <UnifiedMessaging
            conversationId={buyerConversationId}
            open={buyerDialogOpen}
            onOpenChange={setBuyerDialogOpen}
            otherParticipantName={buyerName}
            title={`Conversation avec ${buyerName} (acheteur)`}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
