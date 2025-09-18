import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Download, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { LockAnimation } from '@/components/ui/lock-animation';
import { generateInvoicePDF } from '@/components/invoice/InvoiceGenerator';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface ValidationButtonsProps {
  transaction: {
    id: string;
    title: string;
    price: number;
    currency: string;
    user_id: string;
    buyer_id: string | null;
    status: string;
    seller_validated: boolean;
    buyer_validated: boolean;
    validation_deadline: string | null;
    funds_released: boolean;
    service_date: string;
  };
  onValidationUpdate: () => void;
}

export const ValidationButtons = ({ transaction, onValidationUpdate }: ValidationButtonsProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { formatAmount } = useCurrency();

  const isSeller = user?.id === transaction.user_id;
  const isBuyer = user?.id === transaction.buyer_id;
  const canValidate = (isSeller || isBuyer) && transaction.status === 'paid' && !transaction.funds_released;

  // Check if we're past service date
  const serviceDate = new Date(transaction.service_date);
  const now = new Date();
  const isPastServiceDate = now > serviceDate;

  // Calculate validation deadline countdown
  const getValidationCountdown = () => {
    if (!transaction.validation_deadline) return null;
    
    const deadline = new Date(transaction.validation_deadline);
    if (now > deadline) return 'Expiré';

    const days = differenceInDays(deadline, now);
    const hours = differenceInHours(deadline, now) % 24;

    if (days > 0) {
      return `${days}j ${hours}h restants`;
    } else if (hours > 0) {
      return `${hours}h restantes`;
    } else {
      return 'Expire bientôt';
    }
  };

  const handleValidation = async (isValid: boolean) => {
    if (!user || !canValidate) return;

    setIsProcessing(true);
    try {
      const updateField = isSeller ? 'seller_validated' : 'buyer_validated';
      
      const { error } = await supabase
        .from('transactions')
        .update({ [updateField]: isValid })
        .eq('id', transaction.id);

      if (error) throw error;

      toast({
        title: isValid ? 'Validation confirmée' : 'Problème signalé',
        description: isValid 
          ? 'Votre validation a été enregistrée.'
          : 'Un problème a été signalé. L\'autre partie en sera notifiée.',
      });

      // Send notification
      await supabase.functions.invoke('send-notifications', {
        body: {
          type: isValid ? 'validation_confirmed' : 'validation_rejected',
          transactionId: transaction.id,
          message: isValid 
            ? `${isSeller ? 'Le vendeur' : 'L\'acheteur'} a confirmé la validation`
            : `${isSeller ? 'Le vendeur' : 'L\'acheteur'} a signalé un problème`,
          recipients: [isSeller ? 'buyer' : 'seller']
        }
      });

      onValidationUpdate();
    } catch (error) {
      console.error('Error updating validation:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour la validation.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReleaseFunds = async () => {
    if (!transaction.seller_validated || !transaction.buyer_validated) return;

    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('capture-payment', {
        body: { transactionId: transaction.id }
      });

      if (error) throw error;

      toast({
        title: '🔓 Fonds libérés !',
        description: `${formatAmount(transaction.price * 0.95, transaction.currency as 'EUR' | 'CHF')} transférés au vendeur (5% de frais prélevés).`,
      });

      // Auto-generate PDF invoice after funds release
      setTimeout(() => {
        handleDownloadInvoice();
        toast({
          title: '📄 Facture générée',
          description: 'La facture PDF a été générée automatiquement.',
        });
      }, 2000);

      onValidationUpdate();
    } catch (error) {
      console.error('Error releasing funds:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de libérer les fonds.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      // Fetch user profiles for invoice
      const userIds = [transaction.user_id];
      if (transaction.buyer_id) userIds.push(transaction.buyer_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      const sellerProfile = profiles?.find(p => p.user_id === transaction.user_id);
      const buyerProfile = profiles?.find(p => p.user_id === transaction.buyer_id);

      const invoiceData = {
        ...transaction,
        seller_profile: sellerProfile,
        buyer_profile: buyerProfile,
        created_at: new Date().toISOString(), // Use current date as fallback
        updated_at: new Date().toISOString(), // Use current date as fallback
        description: transaction.title, // Use title as description fallback
      };

      generateInvoicePDF(invoiceData);
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de générer la facture.',
      });
    }
  };

  if (!canValidate) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Validation disponible après le paiement</p>
        </CardContent>
      </Card>
    );
  }

  if (transaction.funds_released) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <CheckCircle className="w-5 h-5" />
              </motion.div>
              Transaction terminée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Les fonds ont été libérés avec succès. Transaction complétée !
              </AlertDescription>
            </Alert>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleDownloadInvoice}
                className="flex-1 gradient-primary text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Télécharger la facture PDF
              </Button>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="w-12 h-12 mx-auto mb-2 text-green-600">🔓</div>
              <p className="text-sm text-green-700">
                Fonds déverrouillés et transférés !
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Validation mutuelle
        </CardTitle>
        <CardDescription>
          Les deux parties doivent valider avant la libération des fonds
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Service date check */}
        {!isPastServiceDate && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Validation possible après la date de service :</strong>{' '}
              {format(serviceDate, 'PPP à HH:mm', { locale: fr })}
            </AlertDescription>
          </Alert>
        )}

        {/* Validation deadline */}
        {transaction.validation_deadline && (
          <Alert variant={getValidationCountdown() === 'Expiré' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Délai de validation :</strong> {getValidationCountdown()}
              <br />
              <span className="text-sm">
                Expire le {format(new Date(transaction.validation_deadline), 'PPP à HH:mm', { locale: fr })}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Vendeur</p>
            <Badge variant={transaction.seller_validated ? 'default' : 'secondary'}>
              {transaction.seller_validated ? 'Validé ✓' : 'En attente'}
            </Badge>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium mb-2">Acheteur</p>
            <Badge variant={transaction.buyer_validated ? 'default' : 'secondary'}>
              {transaction.buyer_validated ? 'Validé ✓' : 'En attente'}
            </Badge>
          </div>
        </div>

        {/* Validation Buttons */}
        {isPastServiceDate && (
          <>
            {!((isSeller && transaction.seller_validated) || (isBuyer && transaction.buyer_validated)) && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Le travail a-t-il été réalisé de manière satisfaisante ?
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleValidation(true)}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Oui, tout est OK
                  </Button>
                  <Button
                    onClick={() => handleValidation(false)}
                    disabled={isProcessing}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Il y a un problème
                  </Button>
                </div>
              </div>
            )}

            {/* Release Funds Button */}
            {transaction.seller_validated && transaction.buyer_validated && (
              <div className="text-center space-y-3">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Validation mutuelle complète !</strong> Cliquez sur le cadenas pour libérer les fonds.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleReleaseFunds}
                  disabled={isProcessing}
                  className="w-full gradient-primary text-white text-lg py-6"
                >
                  <LockAnimation isLocked={false} size="sm" className="mr-2" />
                  🔓 Libérer les fonds
                </Button>
                <p className="text-sm text-muted-foreground">
                  Montant vendeur : {formatAmount(transaction.price * 0.95, transaction.currency as 'EUR' | 'CHF')} 
                  <br />
                  Frais plateforme : {formatAmount(transaction.price * 0.05, transaction.currency as 'EUR' | 'CHF')} (5%)
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};