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
            className={`${isMobile ? 'flex-1 min-w-0 px-2 text-[11px]' : 'text-xs'}`}
          >
            <Icon className={`h-3 w-3 flex-shrink-0 ${isMobile ? '' : 'mr-1'}`} />
            <span className={`truncate ${isMobile ? 'mx-0.5' : 'ml-1'}`}>{option.label}</span>
            {sortBy === option.value && (
              <span className={`flex-shrink-0 ${isMobile ? 'text-[11px] ml-0.5' : 'text-xs ml-1'}`}>
                {sortOrder === 'desc' ? '↓' : '↑'}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
