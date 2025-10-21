import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ItemRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Props {
  items: ItemRow[];
  currency: string;
  onItemsChange: (items: ItemRow[]) => void;
  readOnly?: boolean;
}

export const DetailedItemsEditor = ({ items, currency, onItemsChange, readOnly = false }: Props) => {
  const addItem = () => {
    const newItems = [...items, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0
    }];
    onItemsChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onItemsChange(newItems);
  };

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = newItems[index].quantity * newItems[index].unit_price;
    }

    onItemsChange(newItems);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium">Lignes détaillées *</Label>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une ligne
          </Button>
        )}
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
          <div key={item.id} className="space-y-2 md:space-y-0 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 p-3 border rounded-lg md:p-0 md:border-0 md:items-center">
            <div>
              <Label className="md:hidden text-xs">Description</Label>
              <Input
                placeholder="Description"
                value={item.description}
                onChange={(e) => updateItem(index, 'description', e.target.value)}
                disabled={readOnly}
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
                  disabled={readOnly}
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
                  disabled={readOnly}
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
            {!readOnly && (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
