import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { Currency } from '@/types';
import { logger } from '@/lib/logger';
import { getPublicBaseUrl } from '@/lib/appUrl';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';
import { useProposalCalculations } from '@/hooks/useProposalCalculations';
import { useProposalItems } from '@/hooks/useProposalItems';
import { ProposalClientInfo } from './ProposalClientInfo';
import { ProposalDetails } from './ProposalDetails';
import { ProposalItems } from './ProposalItems';
import { ProposalFeeDistribution } from './ProposalFeeDistribution';
import { ProposalDates } from './ProposalDates';
import type { ProposalItem, CreateProposalDialogProps, ProposalMode } from './types';

export type { CreateProposalDialogProps, ProposalMode, ProposalItem };

/**
 * Composant unifié pour créer des devis ou des transactions
 * 
 * Architecture modulaire optimisée :
 * - Sous-composants mémoïsés pour performance
 * - Hooks personnalisés pour logique réutilisable
 * - Validation centralisée
 * - Support mode 'quote' et 'transaction'
 */
export const CreateProposalDialog = ({
  open,
  onOpenChange,
  onSuccess,
  mode,
}: CreateProposalDialogProps) => {
  const { data: profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);

  // État du formulaire
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<Currency>('eur');
  const [serviceDate, setServiceDate] = useState<Date | undefined>();
  const [serviceTime, setServiceTime] = useState('');
  const [serviceEndDate, setServiceEndDate] = useState<Date | undefined>();
  const [validUntil, setValidUntil] = useState<Date>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );
  const [feeRatio, setFeeRatio] = useState(0);

  // Gestion des items avec système baseItems (snapshot immutable)
  const [items, setItems] = useState<ProposalItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [baseItems, setBaseItems] = useState<ProposalItem[]>([]);
  const [autoDistributionApplied, setAutoDistributionApplied] = useState(false);

  // État pour le partage (mode transaction)
  const [shareLinkDialogOpen, setShareLinkDialogOpen] = useState(false);
  const [createdTransaction, setCreatedTransaction] = useState<any>(null);

  // Auto-détection devise selon pays
  useEffect(() => {
    if (profile?.country) {
      setCurrency(profile.country === 'CH' ? 'chf' : 'eur');
    }
  }, [profile?.country]);

  // Snapshot baseItems quand items change (sauf si auto-distribution active)
  useEffect(() => {
    if (!autoDistributionApplied) {
      setBaseItems(items.map((item) => ({ ...item })));
    }
  }, [items, autoDistributionApplied]);

  // Calculs financiers centralisés
  const calculations = useProposalCalculations(baseItems, feeRatio);

  // Gestionnaires d'items
  const itemHandlers = useProposalItems(
    items,
    setItems,
    baseItems,
    feeRatio,
    setAutoDistributionApplied
  );

  // Réinitialisation du formulaire
  const resetForm = () => {
    setClientEmail('');
    setClientName('');
    setTitle('');
    setDescription('');
    setItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
    setServiceDate(undefined);
    setServiceTime('');
    setServiceEndDate(undefined);
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    setFeeRatio(0);
    setAutoDistributionApplied(false);
    setBaseItems([]);
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations communes
    if (!clientEmail || !title || items.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (
      items.some(
        (item) =>
          !item.description || item.quantity <= 0 || item.unit_price <= 0
      )
    ) {
      toast.error('Toutes les lignes doivent être complètes');
      return;
    }

    // Validation spécifique mode transaction
    if (mode === 'transaction' && !serviceDate) {
      toast.error('La date de service est obligatoire pour une transaction');
      return;
    }

    setIsLoading(true);

    try {
      // Calculer le montant final
      const currentSubtotal = items.reduce((sum, item) => sum + item.total, 0);
      const currentTaxAmount =
        currentSubtotal * (calculations.taxRate / 100);
      const currentTotalAmount = currentSubtotal + currentTaxAmount;

      const submittedTotalAmount = autoDistributionApplied
        ? currentTotalAmount
        : calculations.finalPrice;

      if (mode === 'quote') {
        // Appel edge function create-quote
        const { data, error } = await supabase.functions.invoke(
          'create-quote',
          {
            body: {
              client_email: clientEmail,
              client_name: clientName || null,
              title,
              description: description || null,
              items,
              currency,
              service_date: serviceDate?.toISOString() || null,
              service_end_date: serviceEndDate?.toISOString() || null,
              valid_until: validUntil.toISOString(),
              total_amount: submittedTotalAmount,
              fee_ratio_client: feeRatio,
            },
          }
        );

        if (error) throw error;

        toast.success('Devis créé et envoyé au client');
        onSuccess();
        resetForm();
        onOpenChange(false);
      } else {
        // Mode transaction
        let serviceDateISO = serviceDate?.toISOString();

        // Intégrer l'heure si fournie
        if (serviceDate && serviceTime) {
          const [hours, minutes] = serviceTime.split(':');
          const dateWithTime = new Date(serviceDate);
          dateWithTime.setHours(parseInt(hours), parseInt(minutes));
          serviceDateISO = dateWithTime.toISOString();
        }

        const { data, error } = await supabase.functions.invoke(
          'create-transaction',
          {
            body: {
              title,
              description: description || null,
              price: submittedTotalAmount,
              currency,
              service_date: serviceDateISO,
              service_end_date: serviceEndDate?.toISOString() || null,
              client_email: clientEmail,
              seller_display_name: clientName || clientEmail,
              fee_ratio_client: feeRatio,
              items,
            },
          }
        );

        if (error) throw error;

        setCreatedTransaction(data.transaction);

        toast.success('Transaction créée avec succès');
        onSuccess();
        resetForm();
        setShareLinkDialogOpen(true);
      }
    } catch (error) {
      logger.error(`Error creating ${mode}:`, error);
      toast.error(
        `Erreur lors de la création ${
          mode === 'quote' ? 'du devis' : 'de la transaction'
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const dialogTitle =
    mode === 'quote' ? 'Créer un devis' : 'Nouvelle transaction';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <ProposalClientInfo
              clientEmail={clientEmail}
              clientName={clientName}
              onClientEmailChange={setClientEmail}
              onClientNameChange={setClientName}
            />

            <ProposalDetails
              mode={mode}
              title={title}
              description={description}
              currency={currency}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onCurrencyChange={(v) => setCurrency(v as Currency)}
            />

            <ProposalItems
              items={items}
              currency={currency}
              taxRate={calculations.taxRate}
              onAddItem={itemHandlers.addItem}
              onRemoveItem={itemHandlers.removeItem}
              onUpdateItem={itemHandlers.updateItem}
            />

            <ProposalFeeDistribution
              feeRatio={feeRatio}
              totalAmount={calculations.totalAmount}
              clientFees={calculations.clientFees}
              sellerFees={calculations.sellerFees}
              finalPrice={calculations.finalPrice}
              currency={currency}
              autoDistributionApplied={autoDistributionApplied}
              onFeeRatioChange={(value) => {
                setFeeRatio(value);
                setAutoDistributionApplied(false);
              }}
              onApplyAutoDistribution={itemHandlers.applyAutoDistribution}
            />

            <ProposalDates
              mode={mode}
              serviceDate={serviceDate}
              serviceTime={serviceTime}
              serviceEndDate={serviceEndDate}
              validUntil={validUntil}
              onServiceDateChange={setServiceDate}
              onServiceTimeChange={setServiceTime}
              onServiceEndDateChange={setServiceEndDate}
              onValidUntilChange={(date) => date && setValidUntil(date)}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? 'Création...'
                  : mode === 'quote'
                  ? 'Créer le devis'
                  : 'Créer la transaction'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de partage pour mode transaction */}
      {mode === 'transaction' && createdTransaction && (
        <ShareLinkDialog
          open={shareLinkDialogOpen}
          onOpenChange={setShareLinkDialogOpen}
          shareLink={`${getPublicBaseUrl()}/payment-link/${
            createdTransaction.shared_link_token
          }`}
          transactionTitle={title}
        />
      )}
    </>
  );
};
