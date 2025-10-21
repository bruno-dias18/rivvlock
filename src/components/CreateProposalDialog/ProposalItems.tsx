import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { ProposalItem } from './types';
import { Currency } from '@/types';

interface ProposalItemsProps {
  items: ProposalItem[];
  currency: Currency;
  taxRate: number;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, field: keyof ProposalItem, value: any) => void;
}

/**
 * Sous-composant pour la gestion des lignes d'items
 * Mémoïsé pour éviter les re-renders inutiles
 */
export const ProposalItems = React.memo(
  ({
    items,
    currency,
    taxRate,
    onAddItem,
    onRemoveItem,
    onUpdateItem,
  }: ProposalItemsProps) => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Lignes *</h3>
          <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une ligne
          </Button>
        </div>

        <div className="space-y-3">
          {/* En-têtes colonnes (desktop) */}
          <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 pb-2 text-sm font-medium text-muted-foreground">
            <div>Description</div>
            <div>Quantité</div>
            <div>Prix unitaire</div>
            <div>Total</div>
            <div></div>
          </div>

          {items.map((item, index) => (
            <div
              key={index}
              className="space-y-2 md:space-y-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 p-3 border rounded-lg md:p-0 md:border-0 md:items-center"
            >
              <div>
                <Label className="md:hidden text-xs">Description</Label>
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) =>
                    onUpdateItem(index, 'description', e.target.value)
                  }
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
                    onChange={(e) =>
                      onUpdateItem(
                        index,
                        'quantity',
                        parseFloat(e.target.value) || 0
                      )
                    }
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
                    onChange={(e) =>
                      onUpdateItem(
                        index,
                        'unit_price',
                        parseFloat(e.target.value) || 0
                      )
                    }
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
                  onClick={() => onRemoveItem(index)}
                  disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Totaux */}
        <div className="space-y-3 pt-4 border-t">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Sous-total HT</span>
              <span className="font-medium">
                {subtotal.toFixed(2)} {currency.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>TVA ({taxRate}%)</span>
              <span>
                {taxAmount.toFixed(2)} {currency.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total TTC</span>
              <span>
                {totalAmount.toFixed(2)} {currency.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ProposalItems.displayName = 'ProposalItems';
