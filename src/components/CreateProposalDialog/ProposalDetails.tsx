import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Currency } from '@/types';
import { ProposalMode } from './types';

interface ProposalDetailsProps {
  mode: ProposalMode;
  title: string;
  description: string;
  currency: Currency;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCurrencyChange: (value: Currency) => void;
}

/**
 * Sous-composant pour les détails de la proposition
 * Mémoïsé pour éviter les re-renders inutiles
 */
export const ProposalDetails = React.memo(
  ({
    mode,
    title,
    description,
    currency,
    onTitleChange,
    onDescriptionChange,
    onCurrencyChange,
  }: ProposalDetailsProps) => {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">
          Détails {mode === 'quote' ? 'du devis' : 'de la transaction'}
        </h3>
        <div>
          <Label htmlFor="title">Titre *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Description du service"
            required
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={3}
            />
          </div>
          <div className="md:w-40">
            <Label htmlFor="currency">Devise</Label>
            <Select value={currency} onValueChange={onCurrencyChange}>
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
    );
  }
);

ProposalDetails.displayName = 'ProposalDetails';
