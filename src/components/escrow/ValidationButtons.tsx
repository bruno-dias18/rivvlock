import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, Download, Lock, Sparkles, Users, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { LockAnimation } from '@/components/ui/lock-animation';
import { generateInvoicePDF } from '@/components/invoice/InvoiceGenerator';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

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
    const now = new Date();
    
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-dashed border-2 border-muted">
          <CardContent className="text-center py-12">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">Validation en attente</h3>
            <p className="text-muted-foreground">La validation sera disponible après le paiement</p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (transaction.funds_released) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-10 h-10 text-white" />
              </motion.div>
            </motion.div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Transaction Réussie !
            </CardTitle>
            <CardDescription className="text-base">
              Les fonds ont été libérés et transférés avec succès
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Alert className="border-primary/20 bg-primary/5">
                <CheckCircle className="h-5 w-5 text-primary" />
                <AlertDescription className="font-medium">
                  Félicitations ! La transaction s'est déroulée avec succès.
                </AlertDescription>
              </Alert>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex gap-3"
            >
              <Button 
                onClick={handleDownloadInvoice}
                className="flex-1 gradient-primary text-white shadow-lg hover:shadow-xl transition-all duration-300"
                size="lg"
              >
                <Download className="w-5 h-5 mr-2" />
                Télécharger la facture
              </Button>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center p-6 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-4xl mb-3"
              >
                🎉
              </motion.div>
              <p className="text-lg font-semibold text-primary mb-2">
                Mission accomplie !
              </p>
              <p className="text-sm text-muted-foreground">
                Fonds sécurisés et transférés selon les conditions convenues
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Calculate validation progress
  const validationProgress = 
    (transaction.seller_validated ? 50 : 0) + 
    (transaction.buyer_validated ? 50 : 0);

  const bothValidated = transaction.seller_validated && transaction.buyer_validated;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-background to-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Validation Sécurisée</CardTitle>
              <CardDescription className="text-base">
                Protection mutuelle avant libération des fonds
              </CardDescription>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">{validationProgress}%</span>
            </div>
            <Progress 
              value={validationProgress} 
              className="h-2 bg-muted"
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Service date check */}
          <AnimatePresence>
            {!isPastServiceDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert className="border-amber-200 bg-amber-50">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Validation disponible après la date de service</strong>
                    <div className="mt-1 text-sm">
                      📅 {format(serviceDate, 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation deadline */}
          <AnimatePresence>
            {transaction.validation_deadline && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert variant={getValidationCountdown() === 'Expiré' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-5 w-5" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <strong>Délai de validation :</strong> {getValidationCountdown()}
                        <div className="text-sm mt-1">
                          ⏰ Expire le {format(new Date(transaction.validation_deadline), 'PPP à HH:mm', { locale: fr })}
                        </div>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Validation Status - Enhanced */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">État des validations</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <motion.div 
                className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                  transaction.seller_validated 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted bg-muted/30'
                }`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-center">
                  <div className="mb-2">
                    {transaction.seller_validated ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                      </motion.div>
                    ) : (
                      <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                    )}
                  </div>
                  <p className="font-medium text-sm mb-1">Vendeur</p>
                  <Badge 
                    variant={transaction.seller_validated ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {transaction.seller_validated ? '✅ Validé' : '⏳ En attente'}
                  </Badge>
                </div>
              </motion.div>

              <motion.div 
                className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                  transaction.buyer_validated 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted bg-muted/30'
                }`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="text-center">
                  <div className="mb-2">
                    {transaction.buyer_validated ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                      >
                        <CheckCircle className="w-8 h-8 text-primary mx-auto" />
                      </motion.div>
                    ) : (
                      <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                    )}
                  </div>
                  <p className="font-medium text-sm mb-1">Acheteur</p>
                  <Badge 
                    variant={transaction.buyer_validated ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {transaction.buyer_validated ? '✅ Validé' : '⏳ En attente'}
                  </Badge>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Validation Buttons - Enhanced */}
          <AnimatePresence>
            {isPastServiceDate && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {!((isSeller && transaction.seller_validated) || (isBuyer && transaction.buyer_validated)) && (
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
                      <h4 className="font-semibold text-primary mb-2">
                        🤝 Votre validation est requise
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Le travail a-t-il été réalisé de manière satisfaisante ?
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={() => handleValidation(true)}
                          disabled={isProcessing}
                          className="w-full bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                          size="lg"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Oui, parfait !
                        </Button>
                      </motion.div>
                      
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={() => handleValidation(false)}
                          disabled={isProcessing}
                          variant="destructive"
                          className="w-full shadow-lg hover:shadow-xl transition-all duration-300"
                          size="lg"
                        >
                          <XCircle className="w-5 h-5 mr-2" />
                          Il y a un souci
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Release Funds Button - Enhanced */}
                {bothValidated && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="space-y-4"
                  >
                    <Alert className="border-primary/30 bg-gradient-to-r from-primary/10 to-secondary/10">
                      <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Sparkles className="h-5 w-5 text-primary" />
                      </motion.div>
                      <AlertDescription className="font-medium text-primary">
                        🎉 <strong>Validation mutuelle réussie !</strong> 
                        <br />
                        Vous pouvez maintenant libérer les fonds en toute sécurité.
                      </AlertDescription>
                    </Alert>
                    
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        onClick={handleReleaseFunds}
                        disabled={isProcessing}
                        className="w-full gradient-primary text-white text-lg py-8 shadow-2xl hover:shadow-3xl transition-all duration-500 border-0"
                        size="lg"
                      >
                        <motion.div
                          animate={{ rotate: isProcessing ? 360 : 0 }}
                          transition={{ duration: 1, repeat: isProcessing ? Infinity : 0, ease: "linear" }}
                          className="mr-3"
                        >
                          <LockAnimation isLocked={false} size="sm" />
                        </motion.div>
                        🔓 Libérer les fonds maintenant
                      </Button>
                    </motion.div>
                    
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <h5 className="font-semibold text-sm">💰 Répartition des fonds :</h5>
                      <div className="flex justify-between text-sm">
                        <span>Montant vendeur :</span>
                        <span className="font-medium text-primary">
                          {formatAmount(transaction.price * 0.95, transaction.currency as 'EUR' | 'CHF')}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Frais plateforme (5%) :</span>
                        <span className="font-medium text-muted-foreground">
                          {formatAmount(transaction.price * 0.05, transaction.currency as 'EUR' | 'CHF')}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total transaction :</span>
                        <span>{formatAmount(transaction.price, transaction.currency as 'EUR' | 'CHF')}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};