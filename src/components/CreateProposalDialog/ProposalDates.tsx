import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ProposalMode } from './types';

interface ProposalDatesProps {
  mode: ProposalMode;
  serviceDate?: Date;
  serviceTime?: string;
  serviceEndDate?: Date;
  validUntil?: Date;
  onServiceDateChange: (date?: Date) => void;
  onServiceTimeChange: (time: string) => void;
  onServiceEndDateChange: (date?: Date) => void;
  onValidUntilChange: (date?: Date) => void;
}

/**
 * Sous-composant adaptatif pour les dates
 * Affiche différents champs selon le mode (quote vs transaction)
 * Mémoïsé pour éviter les re-renders inutiles
 */
export const ProposalDates = React.memo(
  ({
    mode,
    serviceDate,
    serviceTime,
    serviceEndDate,
    validUntil,
    onServiceDateChange,
    onServiceTimeChange,
    onServiceEndDateChange,
    onValidUntilChange,
  }: ProposalDatesProps) => {
    return (
      <div className="space-y-4">
        <h3 className="font-medium">Dates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date de service (optionnelle pour quote, obligatoire pour transaction) */}
          <div>
            <Label htmlFor="service-date">
              Date de service {mode === 'transaction' && '*'}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceDate
                    ? format(serviceDate, 'PPP', { locale: fr })
                    : 'Sélectionner...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={serviceDate}
                  onSelect={onServiceDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Heure de service (mode transaction uniquement) */}
          {mode === 'transaction' && serviceDate && (
            <div>
              <Label htmlFor="service-time">Heure de service</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="service-time"
                  type="time"
                  value={serviceTime || ''}
                  onChange={(e) => onServiceTimeChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Date de fin (optionnelle) */}
          <div>
            <Label htmlFor="service-end-date">Date de fin (optionnelle)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {serviceEndDate
                    ? format(serviceEndDate, 'PPP', { locale: fr })
                    : 'Sélectionner...'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={serviceEndDate}
                  onSelect={onServiceEndDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Validité du devis (mode quote uniquement) */}
          {mode === 'quote' && (
            <div>
              <Label htmlFor="valid-until">Validité du devis</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {validUntil
                      ? format(validUntil, 'PPP', { locale: fr })
                      : 'Sélectionner...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={validUntil}
                    onSelect={onValidUntilChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ProposalDates.displayName = 'ProposalDates';
