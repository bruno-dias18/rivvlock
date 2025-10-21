import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { Currency } from '@/types';
import { QuoteItem } from '@/types/quotes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { logger } from '@/lib/logger';

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
  const [feeRatio, setFeeRatio] = useState(0); // 0-100
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [autoDistributionApplied, setAutoDistributionApplied] = useState(false);

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

  // Calculate fees based on feeRatio
  const totalFees = totalAmount * PLATFORM_FEE_RATE;
  const clientFees = totalFees * (feeRatio / 100);
  const sellerFees = totalFees * (1 - feeRatio / 100);
  const finalPrice = totalAmount + clientFees;

  const applyAutoDistribution = () => {
    if (feeRatio === 0 || totalAmount === 0) {
      toast.info('Aucune répartition à appliquer (frais client à 0%)');
      return;
    }

    // Calculer le ratio d'augmentation à appliquer
    const ratio = finalPrice / totalAmount;

    // Appliquer le ratio sur tous les prix unitaires
    const adjustedItems = items.map(item => ({
      ...item,
      unit_price: item.unit_price * ratio,
      total: item.quantity * (item.unit_price * ratio)
    }));

    setItems(adjustedItems);
    setAutoDistributionApplied(true);
    toast.success('Frais répartis automatiquement sur toutes les lignes');
  };

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

    // Recalculer avec les valeurs actuelles des lignes (possiblement ajustées)
    const currentSubtotal = items.reduce((sum, item) => sum + item.total, 0);
    const currentTaxAmount = currentSubtotal * (taxRate / 100);
    const currentTotalAmount = currentSubtotal + currentTaxAmount;
    
    // Si auto-distribution appliquée, le total TTC des lignes inclut déjà les frais
    const submittedTotalAmount = autoDistributionApplied 
      ? currentTotalAmount 
      : finalPrice;

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
          valid_until: validUntil.toISOString(),
          total_amount: submittedTotalAmount,
          fee_ratio_client: feeRatio
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
      logger.error('Error creating quote:', error);
      toast.error('Erreur lors de la création du devis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
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
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
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
              <div className="md:w-40">
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
              {/* En-têtes des colonnes (desktop uniquement) */}
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 pb-2 text-sm font-medium text-muted-foreground">
                <div>Description</div>
                <div>Quantité</div>
                <div>Prix unitaire</div>
                <div>Total</div>
                <div></div>
              </div>

              {items.map((item, index) => (
                <div key={index} className="space-y-2 md:space-y-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 p-3 border rounded-lg md:p-0 md:border-0 md:items-center">
                  <div>
                    <Label className="md:hidden text-xs">Description</Label>
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 md:contents">
                    <div>
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
                    <div>
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
                    <div>
                      <Label className="md:hidden text-xs">Total</Label>
                      <Input
                        type="number"
                        value={item.total.toFixed(2)}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end md:justify-center">
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

              {/* Fee distribution slider */}
              {totalAmount > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="fee-distribution-quote" className="text-sm font-medium">
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
                        le support client et la médiation. Vous pouvez ajuster vos prix manuellement 
                        ou utiliser le slider pour répercuter automatiquement.
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
                      id="fee-distribution-quote"
                      value={[feeRatio]}
                      onValueChange={([value]) => {
                        setFeeRatio(value);
                        setAutoDistributionApplied(false);
                      }}
                      min={0}
                      max={100}
                      step={10}
                      className="w-full"
                    />

                    <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Frais à charge du client</p>
                        <p className="font-semibold text-base">
                          {clientFees.toFixed(2)} {currency.toUpperCase()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Frais à votre charge</p>
                        <p className="font-semibold text-base">
                          {sellerFees.toFixed(2)} {currency.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Bouton de répartition automatique */}
                    <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                      <p className="text-sm text-muted-foreground">
                        {autoDistributionApplied 
                          ? "✓ Les frais ont été répartis automatiquement sur toutes les lignes"
                          : "Choisissez comment gérer les frais de plateforme :"}
                      </p>
                      
                      {/* Bouton de répartition automatique */}
                      <Button
                        type="button"
                        variant={autoDistributionApplied ? "outline" : "default"}
                        size="sm"
                        onClick={applyAutoDistribution}
                        disabled={feeRatio === 0}
                        className="w-full"
                      >
                        {autoDistributionApplied ? "Réappliquer la répartition" : "Répartir automatiquement"}
                      </Button>
                      
                      {/* Messages contextuels conditionnels */}
                      {!autoDistributionApplied && feeRatio > 0 && (
                        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                          <AlertDescription className="text-xs">
                            💡 <strong>Alternative :</strong> Vous pouvez aussi ajuster manuellement les prix dans les lignes ci-dessus, 
                            ou créer une ligne dédiée "Frais de plateforme RivvLock" pour séparer les frais du montant principal.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {autoDistributionApplied && (
                        <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <AlertDescription className="text-xs">
                            ℹ️ Les prix ont été ajustés proportionnellement. Vous pouvez encore les modifier manuellement 
                            dans les lignes ci-dessus si vous le souhaitez.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2 rounded-lg border p-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prix final pour le client</span>
                        <span className="font-medium">
                          {finalPrice.toFixed(2)} {currency.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-medium">Vous recevrez</span>
                        <span className="font-bold text-lg text-green-600">
                          {(totalAmount - sellerFees).toFixed(2)} {currency.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
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
