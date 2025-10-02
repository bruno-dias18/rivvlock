import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';

interface SortButtonsProps {
  sortBy: 'created_at' | 'service_date';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'created_at' | 'service_date') => void;
  isMobile?: boolean;
}

export function SortButtons({ sortBy, sortOrder, onSortChange, isMobile }: SortButtonsProps) {
  return (
    <div className={`flex gap-1.5 ${isMobile ? 'w-full' : ''}`}>
      <Button
        variant={sortBy === 'created_at' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('created_at')}
        className={`text-xs ${isMobile ? 'flex-1' : ''}`}
      >
        <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">Création</span>
        {sortBy === 'created_at' && (
          <span className="ml-1 text-xs flex-shrink-0">
            {sortOrder === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </Button>
      <Button
        variant={sortBy === 'service_date' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('service_date')}
        className={`text-xs ${isMobile ? 'flex-1' : ''}`}
      >
        <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">Service</span>
        {sortBy === 'service_date' && (
          <span className="ml-1 text-xs flex-shrink-0">
            {sortOrder === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </Button>
    </div>
  );
}
