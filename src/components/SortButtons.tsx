import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';

interface SortButtonsProps {
  sortBy: 'created_at' | 'service_date';
  onSortChange: (sortBy: 'created_at' | 'service_date') => void;
}

export function SortButtons({ sortBy, onSortChange }: SortButtonsProps) {
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
      </Button>
      <Button
        variant={sortBy === 'service_date' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onSortChange('service_date')}
        className="text-xs"
      >
        <Calendar className="h-3 w-3 mr-1" />
        Service
      </Button>
    </div>
  );
}
