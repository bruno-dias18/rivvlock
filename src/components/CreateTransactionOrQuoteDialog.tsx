import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, FileText, CreditCard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { Currency } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { DetailedItemsEditor, ItemRow } from '@/components/shared/DetailedItemsEditor';
import { FeeDistributionSlider } from '@/components/shared/FeeDistributionSlider';
import { PaymentDeadlineSelector } from '@/components/shared/PaymentDeadlineSelector';
import { ShareLinkDialog } from '@/components/ShareLinkDialog';

const PLATFORM_FEE_RATE = 0.05; // 5%

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultType?: 'transaction' | 'quote';
}

type FormType = 'transaction' | 'quote';

export const CreateTransactionOrQuoteDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  defaultType = 'transaction'
}: Props) => {
  const { data: profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [formType, setFormType] = useState<FormType>(defaultType);
  const [feeRatio, setFeeRatio] = useState(0);
  const [autoDistributionApplied, setAutoDistributionApplied] = useState(false);

  // Share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [shareType, setShareType] = useState<'transaction' | 'quote'>('transaction');

  const getDefaultCurrency = (): Currency => {
    if (profile?.country === 'CH') return 'chf';
    return 'eur';
  };

  // Form fields
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<Currency>(getDefaultCurrency());
  const [serviceDate, setServiceDate] = useState<Date>();
  const [serviceEndDate, setServiceEndDate] = useState<Date>();
  const [serviceTime, setServiceTime] = useState<string>('');
  const [serviceEndTime, setServiceEndTime] = useState<string>('');
  const [paymentDeadlineHours, setPaymentDeadlineHours] = useState<'24' | '72' | '168'>('24');
  
  // For quotes: valid_until date
  const [validUntil, setValidUntil] = useState<Date>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  // Items (detailed mode)
  const [items, setItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 }
  ]);
  const [originalItems, setOriginalItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 }
  ]);

  useEffect(() => {
    if (profile?.country) {
      setCurrency(getDefaultCurrency());
    }
  }, [profile?.country]);

  // Reset end date if it becomes invalid
  useEffect(() => {
    if (serviceEndDate && serviceDate && serviceEndDate < serviceDate) {
      setServiceEndDate(undefined);
      setServiceEndTime('');
      toast.info('La date de fin a été réinitialisée car elle était avant la date de début');
    }
  }, [serviceDate, serviceEndDate]);

  // Sync originalItems when items change (if no auto-distribution applied)
  useEffect(() => {
    if (!autoDistributionApplied) {
      setOriginalItems([...items]);
    }
  }, [items, autoDistributionApplied]);

  const handleItemsChange = (newItems: ItemRow[]) => {
    setItems(newItems);
    if (!autoDistributionApplied) {
      setOriginalItems(newItems);
    }
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const totalFees = totalAmount * PLATFORM_FEE_RATE;
  const clientFees = totalFees * (feeRatio / 100);
  const finalPrice = totalAmount + clientFees;

  const roundToNearestFiveCents = (value: number): number => {
    return Math.ceil(value * 20) / 20;
  };

  const applyAutoDistribution = () => {
    if (feeRatio === 0) {
      setItems(originalItems.map(item => ({
        ...item,
        total: item.quantity * item.unit_price
      })));
      setAutoDistributionApplied(false);
      toast.info('Frais client à 0% : prix de base restaurés');
      return;
    }

    if (totalAmount === 0) {
      toast.info('Aucune répartition à appliquer (montant total à 0)');
      return;
    }

    const baseSubtotal = originalItems.reduce((sum, item) => sum + item.total, 0);
    const baseTaxAmount = baseSubtotal * (taxRate / 100);
    const baseTotalAmount = baseSubtotal + baseTaxAmount;
    
    const baseTotalFees = baseTotalAmount * PLATFORM_FEE_RATE;
    const baseClientFees = baseTotalFees * (feeRatio / 100);
    const baseFinalPrice = baseTotalAmount + baseClientFees;
    
    const ratio = baseFinalPrice / baseTotalAmount;

    const adjustedItems = originalItems.map(item => ({
      ...item,
      unit_price: roundToNearestFiveCents(item.unit_price * ratio),
      total: roundToNearestFiveCents(item.quantity * (item.unit_price * ratio))
    }));

    setItems(adjustedItems);
    setAutoDistributionApplied(true);
    toast.success(`Frais répartis automatiquement (${feeRatio}% client)`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || items.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error('Toutes les lignes doivent être complètes');
      return;
    }

    // Transaction: service_date is required
    if (formType === 'transaction' && !serviceDate) {
      toast.error('La date de prestation est requise pour une transaction');
      return;
    }

    // Validate end date is after start date
    if (serviceEndDate && serviceDate && serviceEndDate < serviceDate) {
      toast.error('La date de fin doit être après la date de début');
      return;
    }

    const currentSubtotal = items.reduce((sum, item) => sum + item.total, 0);
    const currentTaxAmount = currentSubtotal * (taxRate / 100);
    const currentTotalAmount = currentSubtotal + currentTaxAmount;
    
    const submittedTotalAmount = autoDistributionApplied 
      ? currentTotalAmount 
      : finalPrice;

    setIsLoading(true);
    try {
      const getFinalDateTime = (date: Date | undefined, time: string): string | undefined => {
        if (!date) return undefined;
        
        // Si pas d'heure spécifiée, utiliser minuit (00:00) par défaut
        if (!time || time.trim() === '') {
          const combined = new Date(date);
          combined.setHours(0, 0, 0, 0);
          return combined.toISOString();
        }
        
        const [hours, minutes] = time.split(':').map(Number);
        const combined = new Date(date);
        combined.setHours(hours, minutes, 0, 0);
        return combined.toISOString();
      };

      if (formType === 'quote') {
        // Create quote
        
        const { data, error } = await supabase.functions.invoke('create-quote', {
          body: {
            client_email: clientEmail || null,
            client_name: clientName || null,
            title,
            description: description || null,
            items: items.map(({ id, ...rest }) => rest),
            currency,
            service_date: getFinalDateTime(serviceDate, serviceTime),
            service_end_date: getFinalDateTime(serviceEndDate, serviceEndTime),
            valid_until: validUntil.toISOString(),
            total_amount: submittedTotalAmount,
            fee_ratio_client: feeRatio
          }
        });

        if (error) throw error;

        if (data?.view_url) {
          setShareLink(data.view_url);
          setShareTitle(title);
          setShareType('quote');
          setShowShareDialog(true);
        }

        toast.success('Devis créé avec succès !');
      } else {
        // Create transaction
        if (!serviceDate) {
          toast.error('La date de prestation est requise');
          return;
        }


        console.log('📤 [TRANSACTION] Sending data:', {
          title,
          price: submittedTotalAmount,
          currency: currency.toUpperCase(),
          service_date: getFinalDateTime(serviceDate, serviceTime),
          service_end_date: getFinalDateTime(serviceEndDate, serviceEndTime),
          client_email: clientEmail || null,
          client_name: clientName || null,
          fee_ratio_client: feeRatio,
        });

        console.log('📤 [TRANSACTION] Data to send:', {
          title,
          price: submittedTotalAmount,
          currency: currency.toUpperCase(),
          service_date: getFinalDateTime(serviceDate, serviceTime),
          service_end_date: getFinalDateTime(serviceEndDate, serviceEndTime),
          client_email: clientEmail || null,
          client_name: clientName || null,
          fee_ratio_client: feeRatio,
        });

        const { data, error } = await supabase.functions.invoke('create-transaction', {
          body: {
            title,
            description: description || null,
            price: submittedTotalAmount,
            currency: currency.toUpperCase(),
            service_date: getFinalDateTime(serviceDate, serviceTime)!,
            service_end_date: getFinalDateTime(serviceEndDate, serviceEndTime),
            client_email: clientEmail || null,
            client_name: clientName || null,
            fee_ratio_client: feeRatio,
          }
        });

        if (error) throw error;

        const createdTransaction = (data as any)?.transaction;
        if (createdTransaction) {
          const finalShareLink = createdTransaction.shareLink || 
            `https://app.rivvlock.com/join/${createdTransaction.shared_link_token}`;
          
          setShareLink(finalShareLink);
          setShareTitle(title);
          setShareType('transaction');
          setShowShareDialog(true);
        }

        toast.success('Transaction créée avec succès !');
      }

      if (onSuccess) onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('❌ [CREATE ERROR]', {
        type: formType,
        error: error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        context: error?.context,
      });
      
      // Log plus de détails sur l'erreur
      if (error?.details) {
        console.error('❌ [VALIDATION DETAILS]', JSON.stringify(error.details, null, 2));
      }
      
      const errorMessage = error?.message || error?.details || 'Erreur inconnue';
      toast.error(`Erreur : ${errorMessage}`);
      logger.error('Error creating form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    const resetItem = { id: crypto.randomUUID(), description: '', quantity: 1, unit_price: 0, total: 0 };
    setClientEmail('');
    setClientName('');
    setTitle('');
    setDescription('');
    setItems([resetItem]);
    setOriginalItems([resetItem]);
    setServiceDate(undefined);
    setServiceEndDate(undefined);
    setServiceTime('');
    setServiceEndTime('');
    setFeeRatio(0);
    setAutoDistributionApplied(false);
    setPaymentDeadlineHours('24');
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
          <DialogHeader>
            <DialogTitle>Nouvelle opération</DialogTitle>
          </DialogHeader>

          <Tabs value={formType} onValueChange={(v) => setFormType(v as FormType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="transaction" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Transaction
              </TabsTrigger>
              <TabsTrigger value="quote" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Devis
              </TabsTrigger>
            </TabsList>

            <TabsContent value={formType} className="space-y-6 mt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Client Info */}
                <div className="space-y-4">
                  <h3 className="font-medium">Informations client</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client-email">Email du client (optionnel)</Label>
                      <Input
                        id="client-email"
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@example.com"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        💡 Optionnel : partagez le lien directement
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="client-name">Nom du client (optionnel)</Label>
                      <Input
                        id="client-name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Jean Dupont"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Details */}
                <div className="space-y-4">
                  <h3 className="font-medium">Détails {formType === 'quote' ? 'du devis' : 'de la transaction'}</h3>
                  <div>
                    <Label htmlFor="title">Titre *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={formType === 'quote' ? 'Développement application web' : 'Cours de guitare'}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Détails..."
                        rows={3}
                      />
                    </div>
                    <div className="md:w-40">
                      <Label htmlFor="currency">Devise *</Label>
                      <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eur">EUR (€)</SelectItem>
                          <SelectItem value="chf">CHF (Fr.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Items */}
                <DetailedItemsEditor
                  items={items}
                  currency={currency.toUpperCase()}
                  onItemsChange={handleItemsChange}
                />

                {/* Totals */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Sous-total HT</span>
                      <span className="font-medium">{subtotal.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>TVA ({taxRate}%)</span>
                      <span>{taxAmount.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total TTC</span>
                      <span>{totalAmount.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                  </div>

                  {totalAmount > 0 && (
                    <FeeDistributionSlider
                      totalAmount={totalAmount}
                      currency={currency.toUpperCase()}
                      feeRatio={feeRatio}
                      onFeeRatioChange={setFeeRatio}
                      onApplyDistribution={applyAutoDistribution}
                      showApplyButton={true}
                    />
                  )}
                </div>

                <Separator />

                {/* Dates */}
                <div className="space-y-4">
                  <h3 className="font-medium">Dates</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Date de prestation {formType === 'transaction' ? '*' : '(optionnel)'}</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !serviceDate && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {serviceDate ? format(serviceDate, 'PPP', { locale: fr }) : 'Sélectionner'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={serviceDate}
                              onSelect={setServiceDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {serviceDate && (
                        <div>
                          <Label htmlFor="service-time">Heure (optionnel)</Label>
                          <Input
                            id="service-time"
                            type="time"
                            value={serviceTime}
                            onChange={(e) => setServiceTime(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* End date (optional for multi-day services) */}
                    {serviceDate && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Date de fin (optionnel - pour services sur plusieurs jours)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full justify-start text-left font-normal',
                                  !serviceEndDate && 'text-muted-foreground'
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {serviceEndDate ? format(serviceEndDate, 'PPP', { locale: fr }) : 'Sélectionner'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={serviceEndDate}
                                onSelect={setServiceEndDate}
                                disabled={(date) => serviceDate ? date < serviceDate : false}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                         {serviceEndDate && (
                          <div>
                            <Label htmlFor="service-end-time">Heure de fin (optionnel)</Label>
                            <Input
                              id="service-end-time"
                              type="time"
                              value={serviceEndTime}
                              onChange={(e) => setServiceEndTime(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              💡 Par défaut : minuit (00:00)
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment deadline selector (only if service_date is set) */}
                  {serviceDate && (
                    <PaymentDeadlineSelector
                      value={paymentDeadlineHours}
                      onChange={setPaymentDeadlineHours}
                      serviceDate={serviceDate}
                      label={formType === 'transaction' ? 'Délai de paiement avant prestation' : 'Anticipation de paiement (si accepté)'}
                      showInfo={true}
                    />
                  )}

                  {formType === 'quote' && (
                    <div>
                      <Label>Valide jusqu'au *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(validUntil, 'PPP', { locale: fr })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={validUntil}
                            onSelect={(date) => date && setValidUntil(date)}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Submit */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? 'Création...' : `Créer ${formType === 'quote' ? 'le devis' : 'la transaction'}`}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ShareLinkDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        shareLink={shareLink}
        transactionTitle={shareTitle}
        type={shareType}
      />
    </>
  );
};
