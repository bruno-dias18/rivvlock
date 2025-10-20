import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Info, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { DateTimePicker } from '@/components/DateTimePicker';
import { ShareLinkDialog } from './ShareLinkDialog';
import { FeeDistributionSection } from './FeeDistributionSection';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { getUserFriendlyError, ErrorMessages } from '@/lib/errorMessages';

const transactionSchema = z.object({
  title: z.string().min(3, 'Le titre doit contenir au moins 3 caractères').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  description: z.string().min(10, 'La description doit contenir au moins 10 caractères').max(500, 'La description ne peut pas dépasser 500 caractères'),
  price: z.number().min(0.01, 'Le prix doit être supérieur à 0'),
  currency: z.enum(['EUR', 'CHF'], { required_error: 'Veuillez sélectionner une devise' }),
  paymentDeadlineHours: z.enum(['24', '72', '168'], { required_error: 'Veuillez sélectionner un délai' }),
  serviceDate: z.date({
    required_error: "La date et l'heure du service sont requises",
  }).refine((date) => {
    const now = new Date();
    const minDate = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h minimum
    return date > minDate;
  }, {
    message: "Le service doit être prévu au minimum 25 heures à l'avance",
  }),
  serviceEndDate: z.date().optional(),
  clientEmail: z.string()
    .email('Email invalide')
    .optional()
    .or(z.literal('')),
}).refine((data) => {
  // If serviceEndDate is provided, it must be >= serviceDate
  if (data.serviceEndDate && data.serviceDate) {
    return data.serviceEndDate >= data.serviceDate;
  }
  return true;
}, {
  message: "La date de fin doit être après ou égale à la date de début",
  path: ["serviceEndDate"],
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface NewTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTransactionDialog({ open, onOpenChange }: NewTransactionDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [transactionTitle, setTransactionTitle] = useState('');
  const [feeRatio, setFeeRatio] = useState(0); // 0-100
  
  // Detailed mode states
  const [detailedMode, setDetailedMode] = useState(false);
  const [items, setItems] = useState<Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>>([]);
  const [autoDistributionApplied, setAutoDistributionApplied] = useState(false);
  
  const { data: profile } = useProfile();
  
  // Determine default currency based on seller's country
  const getDefaultCurrency = () => {
    if (profile?.country === 'CH') return 'CHF';
    return 'EUR'; // Default for FR and fallback
  };

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      currency: getDefaultCurrency(),
      paymentDeadlineHours: '24', // Default to 24h
    },
  });

  // Update currency when profile loads
  useEffect(() => {
    if (profile?.country) {
      form.setValue('currency', getDefaultCurrency());
    }
  }, [profile?.country, form]);

  // Sync price field with detailed items total
  useEffect(() => {
    if (detailedMode && items.length > 0) {
      const total = items.reduce((sum, item) => sum + item.total, 0);
      form.setValue('price', total, { shouldValidate: true });
    }
  }, [detailedMode, items, form]);

  // Watch price and currency for net amount calculation
  const watchedPrice = useWatch({
    control: form.control,
    name: 'price'
  });

  const watchedCurrency = useWatch({
    control: form.control,
    name: 'currency'
  });

  // Calculate net amount (after 5% platform fee)
  const platformFee = watchedPrice * 0.05;
  const netAmount = watchedPrice - platformFee;

  // Reverse calculation: to receive exactly watchedPrice, how much to charge?
  const reversePrice = watchedPrice / 0.95;
  const reverseFee = reversePrice - watchedPrice;

  const handleApplyReversePrice = () => {
    const roundedPrice = parseFloat(reversePrice.toFixed(2));
    form.setValue('price', roundedPrice);
    toast.success(`Prix mis à jour : ${roundedPrice.toFixed(2)} ${watchedCurrency}`, {
      description: 'Les frais seront répercutés au client'
    });
  };

  // Detailed mode functions
  const addItem = () => {
    setItems([...items, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof typeof items[0], value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const switchToDetailedMode = () => {
    const currentPrice = form.getValues('price');
    const currentTitle = form.getValues('title');
    
    if (currentPrice > 0) {
      setItems([{
        id: crypto.randomUUID(),
        description: currentTitle || 'Prestation',
        quantity: 1,
        unit_price: currentPrice,
        total: currentPrice
      }]);
    } else {
      setItems([{
        id: crypto.randomUUID(),
        description: '',
        quantity: 1,
        unit_price: 0,
        total: 0
      }]);
    }
    setDetailedMode(true);
    setAutoDistributionApplied(false);
  };

  const switchToSimpleMode = () => {
    const total = items.reduce((sum, item) => sum + item.total, 0);
    form.setValue('price', total);
    setItems([]);
    setDetailedMode(false);
    setAutoDistributionApplied(false);
  };

  // Utility function to round to nearest 5 cents (up)
  const roundToNearestFiveCents = (value: number): number => {
    return Math.ceil(value * 20) / 20;
  };

  const applyAutoDistribution = () => {
    if (feeRatio === 0 || items.length === 0) {
      toast.info('Aucune répartition à appliquer (frais client à 0%)');
      return;
    }

    const currentTotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalFees = currentTotal * 0.05263;
    const clientFees = totalFees * (feeRatio / 100);
    const finalPrice = currentTotal + clientFees;
    const ratio = finalPrice / currentTotal;

    const adjustedItems = items.map(item => {
      const newUnitPrice = roundToNearestFiveCents(item.unit_price * ratio);
      return {
        ...item,
        unit_price: newUnitPrice,
        total: roundToNearestFiveCents(item.quantity * newUnitPrice)
      };
    });

    setItems(adjustedItems);
    setAutoDistributionApplied(true);
    toast.success('Frais répartis automatiquement sur toutes les lignes');
  };

  const onSubmit = async (data: TransactionFormData) => {
    console.log('[NewTransactionDialog] onSubmit called with data:', data);
    setIsLoading(true);
    try {
      let finalPrice: number;
      let itemsToSend: any[] = [];

      if (detailedMode && items.length > 0) {
        // Validate all items are complete
        if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price <= 0)) {
          toast.error('Toutes les lignes doivent être complètes');
          setIsLoading(false);
          return;
        }

        // Mode détaillé : calculer à partir des lignes
        const currentTotal = items.reduce((sum, item) => sum + item.total, 0);
        
        if (autoDistributionApplied) {
          // Les frais sont déjà dans les lignes
          finalPrice = currentTotal;
        } else {
          // Calculer les frais client
          const totalFees = currentTotal * 0.05263;
          const clientFees = totalFees * (feeRatio / 100);
          finalPrice = currentTotal + clientFees;
        }
        
        itemsToSend = items.map(({ id, ...rest }) => rest);
      } else {
        // Mode simple : utiliser le prix du formulaire
        const totalFees = data.price * 0.05263;
        const clientFees = totalFees * (feeRatio / 100);
        finalPrice = data.price + clientFees;
      }

      // Build payload with only allowed keys and without nulls
      const payload: any = {
        title: data.title,
        description: data.description,
        price: finalPrice,
        currency: data.currency,
        service_date: data.serviceDate.toISOString(),
        fee_ratio_client: feeRatio,
      };
      if (data.clientEmail && data.clientEmail.trim() !== '') {
        payload.client_email = data.clientEmail.trim();
      }

      const { data: result, error } = await supabase.functions.invoke('create-transaction', {
        body: payload,
      });

      if (error) {
        console.error('[NewTransactionDialog] Edge function error:', error);
        throw error;
      }

      console.log('[NewTransactionDialog] Edge function result:', result);

      if (!(result as any)?.transaction) {
        throw new Error('Réponse inattendue du serveur (transaction manquante)');
      }

      const createdTransaction = (result as any).transaction;
      
      // Build shareLink if not provided by backend (for backward compatibility)
      const finalShareLink = createdTransaction.shareLink || 
        `https://app.rivvlock.com/join/${createdTransaction.shared_link_token}`;

      // Show success and share link
      setTransactionTitle(createdTransaction.title);
      setShareLink(finalShareLink);
      
      // Log the activity
      await logActivity({
        type: 'transaction_created',
        title: `Transaction "${(result as any).transaction.title}" créée`,
        description: `Nouvelle transaction d'escrow créée pour ${detailedMode ? items.reduce((sum, item) => sum + item.total, 0) : data.price} ${data.currency}`,
        metadata: {
          transaction_id: (result as any).transaction.id,
          amount: finalPrice,
          currency: data.currency,
          service_date: data.serviceDate.toISOString(),
          detailed_mode: detailedMode
        }
      });
      
      onOpenChange(false);
      form.reset();
      setDetailedMode(false);
      setItems([]);
      setAutoDistributionApplied(false);
      setShowShareDialog(true);
      
      toast.success('Transaction créée avec succès !');
    } catch (error: any) {
      logger.error('Error creating transaction:', error);
      const friendly = getUserFriendlyError(error, { statusCode: error?.status });
      toast.error(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setDetailedMode(false);
    setItems([]);
    setAutoDistributionApplied(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle transaction</DialogTitle>
          </DialogHeader>

        <Form {...form}>
          <form 
            onSubmit={(e) => {
              console.log('[NewTransactionDialog] Form submit event triggered');
              console.log('[NewTransactionDialog] Form errors:', form.formState.errors);
              form.handleSubmit(
                onSubmit,
                (errors) => {
                  console.error('[NewTransactionDialog] Validation errors:', errors);
                  const firstError = Object.values(errors)[0]?.message;
                  toast.error(firstError || 'Veuillez vérifier tous les champs du formulaire');
                }
              )(e);
            }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <div className="overflow-y-auto space-y-6 px-1 pb-[40vh]">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titre du service</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: Cours de guitare" 
                      enterKeyHint="next"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Décrivez votre service en détail (ex: type de prestation, durée, adresse d'intervention, matériel inclus...)"
                      className="min-h-[100px]"
                      enterKeyHint="next"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mode simple / détaillé */}
            {!detailedMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prix</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            inputMode="decimal"
                            enterKeyHint="next"
                            {...field}
                            onFocus={(e) => {
                              if (e.target.value === '0') {
                                e.target.value = '';
                                field.onChange('');
                              }
                            }}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Devise</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une devise" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={switchToDetailedMode}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter des lignes détaillées
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Lignes détaillées</Label>
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="CHF">CHF</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* En-têtes des colonnes (desktop uniquement) */}
                  <div className="hidden md:grid md:grid-cols-12 gap-2 pb-2 text-sm font-medium text-muted-foreground">
                    <div className="md:col-span-5">Description</div>
                    <div className="md:col-span-2">Quantité</div>
                    <div className="md:col-span-2">Prix unitaire</div>
                    <div className="md:col-span-2">Total</div>
                    <div className="md:col-span-1"></div>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={item.id} className="space-y-2 md:space-y-0 md:grid md:grid-cols-12 gap-2 p-3 border rounded-lg md:p-0 md:border-0 md:items-end">
                        <div className="md:col-span-5">
                          <Label className="md:hidden text-xs">Description</Label>
                          <Input
                            placeholder="Description de la prestation"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="mt-1 md:mt-0"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="md:hidden text-xs">Quantité</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="1"
                            value={item.quantity}
                            onFocus={(e) => {
                              if (item.quantity === 1) {
                                e.target.value = '';
                              }
                            }}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                            className="mt-1 md:mt-0"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="md:hidden text-xs">Prix unitaire</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unit_price}
                            onFocus={(e) => {
                              if (item.unit_price === 0) {
                                e.target.value = '';
                              }
                            }}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="mt-1 md:mt-0"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label className="md:hidden text-xs">Total</Label>
                          <div className="mt-1 md:mt-0 font-medium text-right md:text-left py-2">
                            {item.total.toFixed(2)}
                          </div>
                        </div>

                        <div className="md:col-span-1 flex justify-end md:justify-start">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            disabled={items.length === 1}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une ligne
                  </Button>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span className="font-medium">
                        {items.reduce((sum, item) => sum + item.total, 0).toFixed(2)} {watchedCurrency}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={switchToSimpleMode}
                    className="w-full"
                  >
                    ← Revenir au mode simple
                  </Button>
                </div>
              </>
            )}

            {/* Fee distribution section */}
            {((detailedMode && items.reduce((sum, item) => sum + item.total, 0) > 0) || (!detailedMode && watchedPrice > 0)) && (
              <FeeDistributionSection
                baseAmount={detailedMode ? items.reduce((sum, item) => sum + item.total, 0) : watchedPrice}
                currency={watchedCurrency}
                feeRatio={feeRatio}
                onFeeRatioChange={setFeeRatio}
                detailedMode={detailedMode}
                onAutoDistribute={detailedMode ? applyAutoDistribution : undefined}
              />
            )}

            <FormField
              control={form.control}
              name="paymentDeadlineHours"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Date limite de paiement</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer rounded-lg border p-3 hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          value="24"
                          checked={field.value === '24'}
                          onChange={() => field.onChange('24')}
                          className="h-4 w-4 text-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium">24 heures avant</div>
                          <div className="text-sm text-muted-foreground">Idéal pour la plupart des services</div>
                        </div>
                      </label>
                      
                      <label className="flex items-center space-x-3 cursor-pointer rounded-lg border p-3 hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          value="72"
                          checked={field.value === '72'}
                          onChange={() => field.onChange('72')}
                          className="h-4 w-4 text-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium">3 jours avant</div>
                          <div className="text-sm text-muted-foreground">Pour anticiper les achats de matériel</div>
                        </div>
                      </label>
                      
                      <label className="flex items-center space-x-3 cursor-pointer rounded-lg border p-3 hover:bg-accent transition-colors">
                        <input
                          type="radio"
                          value="168"
                          checked={field.value === '168'}
                          onChange={() => field.onChange('168')}
                          className="h-4 w-4 text-primary"
                        />
                        <div className="flex-1">
                          <div className="font-medium">1 semaine avant</div>
                          <div className="text-sm text-muted-foreground">Pour une planification longue</div>
                        </div>
                      </label>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Le client devra payer avant cette date pour confirmer la transaction
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date de début du service *</FormLabel>
                  <FormControl>
                    <DateTimePicker
                      date={field.value}
                      onDateChange={field.onChange}
                      placeholder="Sélectionner une date et heure"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceEndDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date de fin du service (optionnel)</FormLabel>
                  <FormControl>
                    <DateTimePicker
                      date={field.value}
                      onDateChange={field.onChange}
                      placeholder="Sélectionner une date de fin"
                    />
                  </FormControl>
                  <FormDescription>
                    Pour les services de plusieurs jours. La validation sera possible 48h après cette date.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>📧 Email du client (optionnel)</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="client@exemple.com"
                      inputMode="email"
                      enterKeyHint="done"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Si vous renseignez l'email, nous enverrons automatiquement :
                    <ul className="mt-1 ml-4 list-disc text-xs">
                      <li>L'invitation au paiement immédiatement</li>
                      <li>Des relances automatiques si non-payé</li>
                    </ul>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <DialogFooter className="shrink-0 mt-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Création...' : 'Créer la transaction'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <ShareLinkDialog
      open={showShareDialog}
      onOpenChange={setShowShareDialog}
      shareLink={shareLink}
      transactionTitle={transactionTitle}
    />
    </>
  );
}