import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DateTimePickerProps {
  date?: Date;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
}

export function DateTimePicker({ 
  date, 
  onDateChange, 
  placeholder = "Sélectionner une date et heure",
  disabled = false,
  className,
  minDate
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date);
  const [selectedHour, setSelectedHour] = useState<string>(
    date ? date.getHours().toString().padStart(2, '0') : '09'
  );
  const [selectedMinute, setSelectedMinute] = useState<string>(
    date ? date.getMinutes().toString().padStart(2, '0') : '00'
  );

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return;
    
    const updatedDate = new Date(newDate);
    updatedDate.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
    
    setSelectedDate(updatedDate);
    onDateChange(updatedDate);
  };

  const handleTimeChange = (hour?: string, minute?: string) => {
    const newHour = hour || selectedHour;
    const newMinute = minute || selectedMinute;
    
    if (hour) setSelectedHour(hour);
    if (minute) setSelectedMinute(minute);
    
    if (selectedDate) {
      const updatedDate = new Date(selectedDate);
      updatedDate.setHours(parseInt(newHour), parseInt(newMinute), 0, 0);
      
      setSelectedDate(updatedDate);
      onDateChange(updatedDate);
    }
  };

  const generateHours = () => {
    return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  };

  const generateMinutes = () => {
    return Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            format(selectedDate, "PPP 'à' HH:mm", { locale: fr })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="space-y-4 p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              const today = new Date(new Date().setHours(0, 0, 0, 0));
              if (date < today) return true;
              if (minDate && date < minDate) return true;
              return false;
            }}
            initialFocus
            className="pointer-events-auto"
          />
          
          <div className="space-y-2">
            <div className="text-sm font-medium">Heure</div>
            <div className="flex gap-2">
              <Select value={selectedHour} onValueChange={(hour) => handleTimeChange(hour, undefined)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateHours().map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedMinute} onValueChange={(minute) => handleTimeChange(undefined, minute)}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {generateMinutes().map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            onClick={() => setIsOpen(false)} 
            className="w-full"
            size="sm"
          >
            Confirmer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}