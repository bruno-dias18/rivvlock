import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';

interface SortButtonsProps {
  sortBy: 'created_at' | 'service_date';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'created_at' | 'service_date') => void;
}

export function SortButtons({ sortBy, sortOrder, onSortChange }: SortButtonsProps) {
  return (
    <div className="flex gap-1">
      <Button
        variant={sortBy === 'created_at' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('created_at')}
        className="text-xs"
      >
        <Clock className="h-3 w-3 mr-1" />
        Création
        {sortBy === 'created_at' && (
          <span className="ml-1 text-xs">
            {sortOrder === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </Button>
      <Button
        variant={sortBy === 'service_date' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('service_date')}
        className="text-xs"
      >
        <Calendar className="h-3 w-3 mr-1" />
        Service
        {sortBy === 'service_date' && (
          <span className="ml-1 text-xs">
            {sortOrder === 'desc' ? '↓' : '↑'}
          </span>
        )}
      </Button>
    </div>
  );
}
