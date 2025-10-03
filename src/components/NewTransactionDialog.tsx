import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
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
import { DateTimePicker } from '@/components/DateTimePicker';
import { ShareLinkDialog } from './ShareLinkDialog';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/lib/activityLogger';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { useKeyboardInsets } from '@/lib/useKeyboardInsets';
import { useIsMobile } from '@/lib/mobileUtils';

const transactionSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  description: z.string().min(1, 'La description est requise').max(500, 'La description ne peut pas dépasser 500 caractères'),
  price: z.number().min(0.01, 'Le prix doit être supérieur à 0'),
  currency: z.enum(['EUR', 'CHF'], { required_error: 'Veuillez sélectionner une devise' }),
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
  
  const { data: profile } = useProfile();
  const keyboardInset = useKeyboardInsets();
  const isMobile = useIsMobile();
  
  // Dynamic dialog height calculation for mobile keyboard handling
  const getDialogHeight = () => {
    if (!isMobile) return 'max-h-[85vh]';
    if (keyboardInset > 0) {
      return `calc(100vh - ${keyboardInset}px - env(safe-area-inset-top, 0px) - 8px)`;
    }
    return 'max-h-[75vh]';
  };
  
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
      const { data: result, error } = await supabase.functions.invoke('create-transaction', {
        body: {
          title: data.title,
          description: data.description,
          price: data.price,
          currency: data.currency,
          serviceDate: data.serviceDate.toISOString(),
          serviceEndDate: data.serviceEndDate?.toISOString()
        }
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      // Show success and share link
      setTransactionTitle(result.transaction.title);
      setShareLink(result.transaction.shareLink);
      
      // Log the activity
      await logActivity({
        type: 'transaction_created',
        title: `Transaction "${result.transaction.title}" créée`,
        description: `Nouvelle transaction d'escrow créée pour ${data.price} ${data.currency}`,
        metadata: {
          transaction_id: result.transaction.id,
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
      toast.error(error.message || 'Erreur lors de la création de la transaction');
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
        <DialogContent 
          className={cn(
            "sm:max-w-[600px] flex flex-col",
            isMobile && "top-2 translate-y-0"
          )}
          style={isMobile ? { maxHeight: getDialogHeight() } : undefined}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Nouvelle transaction</DialogTitle>
          </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 space-y-6 px-1 pb-2">
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
                      placeholder="Décrivez votre service en détail..."
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

            {/* Net amount display for seller */}
            {watchedPrice > 0 && (
              <div className="rounded-lg bg-muted/50 p-4 border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Prix demandé :</span>
                  <span>{watchedPrice.toFixed(2)} {watchedCurrency}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Frais plateforme (5%) :</span>
                  <span>-{platformFee.toFixed(2)} {watchedCurrency}</span>
                </div>
                <div className="flex items-center justify-between font-medium text-primary border-t pt-2 mt-2">
                  <span>Vous recevrez :</span>
                  <span>{netAmount.toFixed(2)} {watchedCurrency}</span>
                </div>
              </div>
            )}

            {/* Reverse calculation: charge client for fees */}
            {watchedPrice > 0 && (
              <div className="rounded-lg bg-blue-50/50 p-4 border border-blue-200">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-lg">💡</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Répercuter les frais au client ?
                    </p>
                    <p className="text-xs text-blue-700">
                      Pour toucher exactement <strong>{watchedPrice.toFixed(2)} {watchedCurrency}</strong>
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700">Facturez :</span>
                    <span className="font-semibold text-blue-900">
                      {reversePrice.toFixed(2)} {watchedCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-blue-600">
                    <span>dont frais payés par client :</span>
                    <span>+{reverseFee.toFixed(2)} {watchedCurrency}</span>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplyReversePrice}
                  className="w-full border-blue-300 hover:bg-blue-100 hover:border-blue-400"
                >
                  → Appliquer ce montant
                </Button>
              </div>
            )}

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
                  <FormDescription>
                    Le paiement devra être effectué au plus tard 24h avant cette date/heure.
                  </FormDescription>
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
            </div>

            <DialogFooter className="shrink-0 mt-4 pt-4 border-t" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
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