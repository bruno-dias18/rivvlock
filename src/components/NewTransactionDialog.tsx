import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Info } from 'lucide-react';
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
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  
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

  const onSubmit = async (data: TransactionFormData) => {
    setIsLoading(true);
    try {
      // Calculer les frais client
      const totalFees = data.price * 0.05263;
      const clientFees = totalFees * (feeRatio / 100);
      const finalPrice = data.price + clientFees;

      const { data: result, error } = await supabase.functions.invoke('create-transaction', {
        body: {
          title: data.title,
          description: data.description,
          price: finalPrice, // Prix final incluant les frais client
          currency: data.currency,
          paymentDeadlineHours: parseInt(data.paymentDeadlineHours),
          serviceDate: data.serviceDate.toISOString(),
          serviceEndDate: data.serviceEndDate?.toISOString(),
          clientEmail: data.clientEmail || null,
          fee_ratio_client: feeRatio
        }
      });

      if (error) {
        throw new Error(getUserFriendlyError(error, { 
          code: (result as any)?.error || error.code 
        }));
      }
      if ((result as any)?.error) {
        throw new Error(ErrorMessages.TRANSACTION_CREATE_FAILED);
      }

      // Show success and share link
      setTransactionTitle((result as any).transaction.title);
      setShareLink((result as any).transaction.shareLink);
      
      // Log the activity
      await logActivity({
        type: 'transaction_created',
        title: `Transaction "${(result as any).transaction.title}" créée`,
        description: `Nouvelle transaction d'escrow créée pour ${data.price} ${data.currency}`,
        metadata: {
          transaction_id: (result as any).transaction.id,
          amount: data.price,
          currency: data.currency,
          service_date: data.serviceDate.toISOString()
        }
      });
      
      onOpenChange(false);
      form.reset();
      setShowShareDialog(true);
      
      toast.success('Transaction créée avec succès !');
    } catch (error: any) {
      logger.error('Error creating transaction:', error);
      toast.error(getUserFriendlyError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.reset();
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
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
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

            {/* Fee distribution slider */}
            {watchedPrice > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="fee-distribution" className="text-sm font-medium">
                    Répartition des frais de plateforme (5%)
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowFeeDetails(!showFeeDetails)}
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                </div>

                {showFeeDetails && (
                  <Alert className="text-xs">
                    <AlertDescription>
                      Les frais de plateforme RivvLock (5%) couvrent la sécurisation des paiements, 
                      le support client et la médiation. Vous pouvez choisir de les répartir entre 
                      vous et votre client selon votre stratégie commerciale.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Client paie</span>
                    <Badge variant="secondary" className="font-mono">
                      {feeRatio}%
                    </Badge>
                  </div>

                  <Slider
                    id="fee-distribution"
                    value={[feeRatio]}
                    onValueChange={([value]) => setFeeRatio(value)}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />

                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Frais à charge du client</p>
                      <p className="font-semibold text-base">
                        {((watchedPrice * 0.05263) * (feeRatio / 100)).toFixed(2)} {watchedCurrency}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Frais à votre charge</p>
                      <p className="font-semibold text-base">
                        {((watchedPrice * 0.05263) * (1 - feeRatio / 100)).toFixed(2)} {watchedCurrency}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Prix final pour le client</span>
                      <span className="font-medium">
                        {(watchedPrice + (watchedPrice * 0.05263 * feeRatio / 100)).toFixed(2)} {watchedCurrency}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Vous recevrez</span>
                      <span className="font-bold text-lg text-green-600">
                        {(watchedPrice - (watchedPrice * 0.05263 * (1 - feeRatio / 100))).toFixed(2)} {watchedCurrency}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
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