import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import { useTransactionMessages } from '@/hooks/useTransactionMessages';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ContactSellerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  currentUserId: string;
  userRole: 'seller' | 'buyer';
}

export function ContactSellerDialog({ open, onOpenChange, transaction, currentUserId, userRole }: ContactSellerDialogProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Vérification de sécurité : ne pas accéder aux propriétés si transaction est null
  const recipientId = transaction ? (userRole === 'seller' ? transaction.buyer_id : transaction.user_id) : '';
  const recipientName = transaction ? (userRole === 'seller' ? transaction.buyer_display_name : transaction.seller_display_name) : '';
  
  const { messages, isLoading, isBlocked, sendMessage } = useTransactionMessages(
    transaction?.id || '',
    currentUserId,
    { enabled: open }
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const success = await sendMessage(message, recipientId);
    if (success) {
      setMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messagerie - {recipientName || 'Utilisateur'}
          </DialogTitle>
          <DialogDescription>
            Transaction: "{transaction?.title}"
          </DialogDescription>
        </DialogHeader>
        
        {isBlocked && (
          <Alert variant="destructive" className="my-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              La messagerie est bloquée car le litige a été escaladé
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto border rounded-md p-4 space-y-3 bg-muted/30 min-h-[300px] max-h-[350px]">
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm">Chargement...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm">Aucun message</div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.sender_id === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 ${
                      isCurrentUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 pt-3">
          <Textarea
            placeholder={isBlocked ? "Messagerie bloquée" : "Écrivez votre message..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={2}
            disabled={isBlocked}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isBlocked || !message.trim()}
            size="icon"
            className="self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}