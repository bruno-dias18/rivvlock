import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { Currency } from '@/types';
import { QuoteItem } from '@/types/quotes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Platform fee rate (RivvLock + Stripe)
const PLATFORM_FEE_RATE = 0.05; // 5%

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateQuoteDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { data: profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);

  const getDefaultCurrency = (): Currency => {
    if (profile?.country === 'CH') return 'chf';
    return 'eur'; // Default pour FR et fallback
  };

  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<Currency>(getDefaultCurrency());
  const [serviceDate, setServiceDate] = useState<Date>();
  const [serviceEndDate, setServiceEndDate] = useState<Date>();
  const [validUntil, setValidUntil] = useState<Date>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  const [items, setItems] = useState<QuoteItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 }
  ]);

  const [showFeesAsSeparateLine, setShowFeesAsSeparateLine] = useState(true);

  useEffect(() => {
    if (profile?.country) {
      setCurrency(getDefaultCurrency());
    }
  }, [profile?.country]);

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }

    setItems(newItems);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  // Calculate platform fees and net amount
  const platformFee = totalAmount * PLATFORM_FEE_RATE;
  const netAmountSeller = totalAmount - platformFee;

  // Reverse calculation: to receive exactly totalAmount net
  const reverseTotal = totalAmount / (1 - PLATFORM_FEE_RATE);
  const reverseFee = reverseTotal - totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientEmail || !title || items.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error('Toutes les lignes doivent être complètes');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('create-quote', {
        body: {
          client_email: clientEmail,
          client_name: clientName || null,
          title,
          description: description || null,
          items,
          currency,
          service_date: serviceDate?.toISOString() || null,
          service_end_date: serviceEndDate?.toISOString() || null,
          valid_until: validUntil.toISOString()
        }
      });

      if (error) throw error;

      toast.success('Devis créé et envoyé au client');
      onSuccess();
      onOpenChange(false);

      // Reset form
      setClientEmail('');
      setClientName('');
      setTitle('');
      setDescription('');
      setItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
      setServiceDate(undefined);
      setServiceEndDate(undefined);
    } catch (error) {
      console.error('Error creating quote:', error);
      toast.error('Erreur lors de la création du devis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Créer un devis</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Informations client</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client-email">Email client *</Label>
                <Input
                  id="client-email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="client-name">Nom client</Label>
                <Input
                  id="client-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Jean Dupont"
                />
              </div>
            </div>
          </div>

          {/* Quote Info */}
          <div className="space-y-4">
            <h3 className="font-medium">Détails du devis</h3>
            <div>
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Développement application web"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Détails du projet..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="currency">Devise</Label>
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

          {/* Items */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Lignes du devis *</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="space-y-2 md:space-y-0 md:grid md:grid-cols-12 gap-2 p-3 border rounded-lg md:p-0 md:border-0 md:items-end">
                  <div className="md:col-span-5">
                    <Label className="md:hidden text-xs">Description</Label>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:contents">
                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs">Qté</Label>
                  <Input
                    type="number"
                    placeholder="Qté"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    required
                  />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs">Prix</Label>
                  <Input
                    type="number"
                    placeholder="Prix"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    onFocus={(e) => e.target.select()}
                    required
                  />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs">Total</Label>
                      <Input
                        type="number"
                        value={item.total.toFixed(2)}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-1 flex justify-end md:justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-3 pt-4 border-t">
              {/* Standard calculation */}
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

              {/* Seller fees display - only if amount > 0 */}
              {totalAmount > 0 && (
                <div className="rounded-lg bg-muted/50 p-4 border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total facturé au client :</span>
                    <span className="font-medium">{totalAmount.toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Frais plateforme (5%) :</span>
                    <span className="text-destructive font-medium">-{platformFee.toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-primary border-t pt-2 mt-2">
                    <span className="flex items-center gap-1">
                      <span>💰</span>
                      <span>Vous recevrez :</span>
                    </span>
                    <span className="text-lg">{netAmountSeller.toFixed(2)} {currency.toUpperCase()}</span>
                  </div>
                </div>
              )}

              {/* Option: pass fees to client */}
              {totalAmount > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-base">💡</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Répercuter les frais sur le client ?
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Pour toucher exactement <strong>{totalAmount.toFixed(2)} {currency.toUpperCase()}</strong> net
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded border border-blue-100 dark:border-blue-900">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-700 dark:text-blue-300">Montant à facturer :</span>
                      <span className="font-bold text-blue-900 dark:text-blue-100 text-base">
                        {reverseTotal.toFixed(2)} {currency.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                      <span>Frais payés par le client :</span>
                      <span className="font-medium">+{reverseFee.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                  </div>
                  
                  {/* Checkbox pour choisir le mode d'affichage */}
                  <div className="flex items-start gap-2 px-1 py-2">
                    <input
                      type="checkbox"
                      id="show-fees-separate"
                      checked={showFeesAsSeparateLine}
                      onChange={(e) => setShowFeesAsSeparateLine(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor="show-fees-separate" 
                        className="text-xs text-blue-700 dark:text-blue-300 cursor-pointer font-medium"
                      >
                        Afficher les frais comme ligne séparée (Recommandé)
                      </label>
                      <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1 leading-tight space-y-0.5">
                        <span className="block">✓ Conformité légale maximale (DGCCRF/LCD)</span>
                        <span className="block">✓ Plus transparent pour le client</span>
                        <span className="block">✓ Facilite la comptabilité</span>
                        <span className="block text-orange-600 dark:text-orange-400 mt-1">
                          ⚠️ Si décoché : la répartition peut être considérée comme pratique commerciale trompeuse
                        </span>
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (showFeesAsSeparateLine) {
                        // Option légalement recommandée : Ajouter une ligne "Frais de plateforme"
                        const feeItem: QuoteItem = {
                          description: "Frais de plateforme RivvLock (5%)",
                          quantity: 1,
                          unit_price: reverseFee,
                          total: reverseFee
                        };
                        setItems([...items, feeItem]);
                        toast.success('Ligne "Frais de plateforme" ajoutée', {
                          description: `+${reverseFee.toFixed(2)} ${currency.toUpperCase()} - Conformité légale maximale`
                        });
                      } else {
                        // Option alternative : Répartir proportionnellement (moins transparent)
                        const ratio = reverseTotal / totalAmount;
                        const adjustedItems = items.map(item => ({
                          ...item,
                          unit_price: parseFloat((item.unit_price * ratio).toFixed(2)),
                          total: parseFloat((item.total * ratio).toFixed(2))
                        }));
                        setItems(adjustedItems);
                        toast.success('Prix ajustés pour inclure les frais', {
                          description: `Frais répartis sur tous les items (+${reverseFee.toFixed(2)} ${currency.toUpperCase()})`
                        });
                      }
                    }}
                    className="w-full border-blue-300 hover:bg-blue-100 dark:border-blue-700 dark:hover:bg-blue-900/50"
                  >
                    → Appliquer ces montants
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-medium">Dates (optionnelles)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Date de prestation</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {serviceDate ? format(serviceDate, 'PPP', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={serviceDate}
                      onSelect={setServiceDate}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {serviceEndDate ? format(serviceEndDate, 'PPP', { locale: fr }) : 'Sélectionner'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={serviceEndDate}
                      onSelect={setServiceEndDate}
                      disabled={(date) => !serviceDate || date < serviceDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Valide jusqu'au *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(validUntil, 'PPP', { locale: fr })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={validUntil}
                      onSelect={(date) => date && setValidUntil(date)}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Création...' : 'Créer et envoyer le devis'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
