import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';

interface TransactionYearMonthFiltersProps {
  selectedYear: number | null;
  selectedMonth: number | null;
  onYearChange: (year: number | null) => void;
  onMonthChange: (month: number | null) => void;
  availableYears: number[];
  isMobile?: boolean;
}

const months = [
  { value: 1, label: 'Janvier' },
  { value: 2, label: 'Février' },
  { value: 3, label: 'Mars' },
  { value: 4, label: 'Avril' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Juin' },
  { value: 7, label: 'Juillet' },
  { value: 8, label: 'Août' },
  { value: 9, label: 'Septembre' },
  { value: 10, label: 'Octobre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Décembre' },
];

export function TransactionYearMonthFilters({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
  availableYears,
  isMobile
}: TransactionYearMonthFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex gap-2 items-center ${isMobile ? 'flex-col w-full' : ''}`}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Période:</span>
      </div>
      
      <Select
        value={selectedYear?.toString() || 'all'}
        onValueChange={(value) => {
          onYearChange(value === 'all' ? null : parseInt(value));
          onMonthChange(null); // Reset month when year changes
        }}
      >
        <SelectTrigger className={`${isMobile ? 'w-full' : 'w-[140px]'}`}>
          <SelectValue placeholder="Toutes les années" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes les années</SelectItem>
          {availableYears.map(year => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={selectedMonth?.toString() || 'all'}
        onValueChange={(value) => onMonthChange(value === 'all' ? null : parseInt(value))}
        disabled={!selectedYear}
      >
        <SelectTrigger className={`${isMobile ? 'w-full' : 'w-[140px]'}`}>
          <SelectValue placeholder="Tous les mois" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les mois</SelectItem>
          {months.map(month => (
            <SelectItem key={month.value} value={month.value.toString()}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
