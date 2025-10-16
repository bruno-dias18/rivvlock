import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Trash2, Info, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { Currency } from '@/types';
import { Quote, QuoteItem } from '@/types/quotes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLATFORM_FEE_RATE = 0.05;

interface Props {
  quote: Quote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditQuoteDialog = ({ quote, open, onOpenChange, onSuccess }: Props) => {
  const { data: profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [feeRatio, setFeeRatio] = useState(quote.fee_ratio_client ?? 0);
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  const [autoDistributionApplied, setAutoDistributionApplied] = useState(false);
  const [discountPercentage, setDiscountPercentage] = useState(quote.discount_percentage ?? 0);
  const [isFeeDistributionOpen, setIsFeeDistributionOpen] = useState(false);

  const [clientEmail] = useState(quote.client_email);
  const [clientName] = useState(quote.client_name || '');
  const [title, setTitle] = useState(quote.title);
  const [description, setDescription] = useState(quote.description || '');
  const [currency, setCurrency] = useState<Currency>(quote.currency);
  const [serviceDate, setServiceDate] = useState<Date | undefined>(
    quote.service_date ? new Date(quote.service_date) : undefined
  );
  const [serviceEndDate, setServiceEndDate] = useState<Date | undefined>(
    quote.service_end_date ? new Date(quote.service_end_date) : undefined
  );
  const [validUntil, setValidUntil] = useState<Date>(new Date(quote.valid_until));

  const [items, setItems] = useState<QuoteItem[]>(quote.items);

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
  const discountAmount = subtotal * (discountPercentage / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxRate = profile?.vat_rate || profile?.tva_rate || 0;
  const taxAmount = subtotalAfterDiscount * (taxRate / 100);
  const totalAmount = subtotalAfterDiscount + taxAmount;

  const totalFees = totalAmount * PLATFORM_FEE_RATE;
  const clientFees = totalFees * (feeRatio / 100);
  const sellerFees = totalFees * (1 - feeRatio / 100);
  const finalPrice = totalAmount + clientFees;

  const applyAutoDistribution = () => {
    if (feeRatio === 0 || totalAmount === 0) {
      toast.info('Aucune répartition à appliquer (frais client à 0%)');
      return;
    }

    const ratio = finalPrice / totalAmount;
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

    if (!title || items.length === 0) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (items.some(item => !item.description || item.quantity <= 0 || item.unit_price <= 0)) {
      toast.error('Toutes les lignes doivent être complètes');
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
      const { error } = await supabase.functions.invoke('update-quote', {
        body: {
          quote_id: quote.id,
          title,
          description: description || null,
          items,
          currency,
          service_date: serviceDate?.toISOString() || null,
          service_end_date: serviceEndDate?.toISOString() || null,
          valid_until: validUntil.toISOString(),
          total_amount: submittedTotalAmount,
          fee_ratio_client: feeRatio,
          discount_percentage: discountPercentage
        }
      });

      if (error) throw error;

      toast.success('Devis modifié et renvoyé au client');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Erreur lors de la modification du devis');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-3xl max-h-[90vh] overflow-y-auto px-4 sm:px-6">
        <DialogHeader>
          <DialogTitle>Modifier le devis</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Info (Read-only) */}
          <div className="space-y-4">
            <h3 className="font-medium">Informations client</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Email client</Label>
                <Input value={clientEmail} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Nom client</Label>
                <Input value={clientName} disabled className="bg-muted" />
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

                {/* Discount Section */}
                {discountPercentage > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-blue-600">
                      <span>Rabais ({discountPercentage}%)</span>
                      <span>-{discountAmount.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span>Sous-total après rabais</span>
                      <span>{subtotalAfterDiscount.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA ({taxRate}%)</span>
                  <span>{taxAmount.toFixed(2)} {currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total TTC</span>
                  <span>{totalAmount.toFixed(2)} {currency.toUpperCase()}</span>
                </div>
              </div>

              {/* Discount Slider */}
              {totalAmount > 0 && (
                <div className="space-y-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Rabais</Label>
                    {discountPercentage > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDiscountPercentage(0)}
                        className="text-xs"
                      >
                        Réinitialiser
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Pourcentage</span>
                    <Badge variant="secondary" className="font-mono">
                      {discountPercentage}%
                    </Badge>
                  </div>
                  
                  <Slider
                    value={[discountPercentage]}
                    onValueChange={([value]) => setDiscountPercentage(value)}
                    min={0}
                    max={50}
                    step={5}
                    className="w-full"
                  />
                  
                  {discountPercentage > 0 && (
                    <div className="flex justify-between text-sm font-medium text-blue-700">
                      <span>Montant du rabais</span>
                      <span>-{discountAmount.toFixed(2)} {currency.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              )}

              {totalAmount > 0 && (
                <>
                  <Collapsible 
                    open={isFeeDistributionOpen} 
                    onOpenChange={setIsFeeDistributionOpen}
                    className="space-y-2"
                  >
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer hover:bg-slate-100 p-2 rounded transition-colors">
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Frais RivvLock</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {feeRatio}% client / {100 - feeRatio}% vous
                            </Badge>
                            {isFeeDistributionOpen ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="fee-distribution-edit" className="text-sm font-medium">
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
                            le support client et la médiation.
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
                          id="fee-distribution-edit"
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

                        <div className="space-y-3 p-4 rounded-lg bg-muted/30 border">
                          <p className="text-sm text-muted-foreground">
                            {autoDistributionApplied 
                              ? "✓ Les frais ont été répartis automatiquement sur toutes les lignes"
                              : "Choisissez comment gérer les frais :"}
                          </p>
                          
                          <Button
                            type="button"
                            variant={autoDistributionApplied ? "outline" : "default"}
                            size="sm"
                            onClick={applyAutoDistribution}
                            disabled={feeRatio === 0}
                            className="w-full"
                          >
                            {autoDistributionApplied ? "Réappliquer" : "Répartir automatiquement"}
                          </Button>

                          {!autoDistributionApplied && (
                            <div className="flex justify-between font-bold text-lg border-t pt-3">
                              <span>Prix final pour le client:</span>
                              <span className="text-primary">{finalPrice.toFixed(2)} {currency.toUpperCase()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Card className="bg-green-50 border-green-300 border-2">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                            <Wallet className="h-5 w-5" />
                            Vous allez recevoir
                          </p>
                          <p className="text-xs text-green-600">
                            Montant net après frais RivvLock
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-green-700">
                            {(totalAmount - sellerFees).toFixed(2)}
                          </p>
                          <p className="text-sm font-medium text-green-600">
                            {currency.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-4">
            <h3 className="font-medium">Dates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : 'Choisir'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={serviceDate}
                      onSelect={setServiceDate}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {serviceEndDate ? format(serviceEndDate, 'dd/MM/yyyy') : 'Choisir'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={serviceEndDate}
                      onSelect={setServiceEndDate}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Valide jusqu'au *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(validUntil, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={validUntil}
                      onSelect={(date) => date && setValidUntil(date)}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Modification...' : 'Modifier et renvoyer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
