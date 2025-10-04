import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type SortOption = {
  value: 'created_at' | 'service_date' | 'funds_released_at';
  label: string;
  icon: any;
};

interface SortButtonsProps {
  sortBy: 'created_at' | 'service_date' | 'funds_released_at';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'created_at' | 'service_date' | 'funds_released_at') => void;
  isMobile?: boolean;
  options?: SortOption[];
}

export function SortButtons({ sortBy, sortOrder, onSortChange, isMobile, options }: SortButtonsProps) {
  const { t } = useTranslation();
  
  // Options par défaut
  const defaultOptions: SortOption[] = [
    { value: 'service_date', label: t('transactions.sort.service'), icon: Calendar },
    { value: 'created_at', label: t('transactions.sort.creation'), icon: Clock },
  ];

  const sortOptions = options || defaultOptions;

  return (
    <div className={`flex gap-1.5 ${isMobile ? 'w-full' : ''}`}>
      {sortOptions.map((option) => {
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            variant={sortBy === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSortChange(option.value)}
            className={`text-xs ${isMobile ? 'flex-1' : ''}`}
          >
            <Icon className="h-3 w-3 mr-1 flex-shrink-0" />
            <span className="truncate">{option.label}</span>
            {sortBy === option.value && (
              <span className="ml-1 text-xs flex-shrink-0">
                {sortOrder === 'desc' ? '↓' : '↑'}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
