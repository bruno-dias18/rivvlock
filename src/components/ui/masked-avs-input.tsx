import React, { useState, forwardRef } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface MaskedAvsInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export const MaskedAvsInput = forwardRef<HTMLInputElement, MaskedAvsInputProps>(
  ({ value = '', onChange, className, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    // Format AVS with dots for readability (756.XXXX.XXXX.XX)
    const formatAvsValue = (digits: string): string => {
      // Remove all non-digits
      const cleaned = digits.replace(/\D/g, '');
      
      // Always start with 756 prefix
      if (cleaned.length === 0) return '756.';
      
      // If user tries to change the 756 prefix, restore it
      if (!cleaned.startsWith('756')) {
        const withoutPrefix = cleaned.replace(/^756/, '');
        const correctedDigits = '756' + withoutPrefix;
        return formatAvsValue(correctedDigits);
      }
      
      // Apply formatting: 756.XXXX.XXXX.XX
      if (cleaned.length <= 3) return '756.';
      if (cleaned.length <= 7) return `756.${cleaned.slice(3)}`;
      if (cleaned.length <= 11) return `756.${cleaned.slice(3, 7)}.${cleaned.slice(7)}`;
      return `756.${cleaned.slice(3, 7)}.${cleaned.slice(7, 11)}.${cleaned.slice(11, 13)}`;
    };

    // Extract only digits from input
    const extractDigits = (input: string): string => {
      return input.replace(/\D/g, '');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      let digits = extractDigits(inputValue);
      
      // Ensure it starts with 756
      if (digits.length >= 3 && !digits.startsWith('756')) {
        // If user is typing and doesn't have 756, prepend it to their input
        if (digits.length > 0) {
          digits = '756' + digits.slice(0, 10); // Limit additional digits to 10
        }
      }
      
      // Limit to 13 digits maximum (756 + 10 additional)
      const limitedDigits = digits.slice(0, 13);
      const formatted = formatAvsValue(limitedDigits);
      
      setDisplayValue(formatted);
      onChange?.(limitedDigits); // Pass only digits to parent
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow navigation keys, delete, backspace
      if (['ArrowLeft', 'ArrowRight', 'Delete', 'Backspace', 'Tab'].includes(e.key)) {
        return;
      }
      
      // Allow only digits
      if (!/^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
      
      // Prevent input if already at 13 digits
      const currentDigits = extractDigits(displayValue);
      if (currentDigits.length >= 13 && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      // If empty, show the prefix
      if (displayValue === '') {
        setDisplayValue('756.');
      }
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      // If only prefix remains, clear the field
      if (displayValue === '756.') {
        setDisplayValue('');
        onChange?.('');
      }
      onBlur?.(e);
    };

    // Update display value when prop value changes
    React.useEffect(() => {
      if (value !== undefined) {
        setDisplayValue(formatAvsValue(value));
      }
    }, [value]);

    const currentDigits = extractDigits(displayValue);
    const isValid = currentDigits.length === 13 && currentDigits.startsWith('756');
    const isEmpty = currentDigits.length === 0;

    // Determine border color based on validation state
    const getBorderColor = () => {
      if (!isFocused && !isEmpty) {
        return isValid ? 'border-green-500' : 'border-red-500';
      }
      return '';
    };

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="756.1234.5678.90"
          className={cn(
            getBorderColor(),
            className
          )}
        />
        <div className="flex justify-between items-center mt-1 text-xs">
          <span className={cn(
            "transition-colors",
            isEmpty ? "text-muted-foreground" : isValid ? "text-green-600" : "text-red-600"
          )}>
            {isEmpty ? "13 chiffres requis (756.XXXX.XXXX.XX)" : isValid ? "Format valide" : "Format invalide"}
          </span>
          <span className={cn(
            "transition-colors",
            currentDigits.length === 13 ? "text-green-600" : 
            currentDigits.length > 10 ? "text-orange-600" : "text-muted-foreground"
          )}>
            {currentDigits.length}/13
          </span>
        </div>
      </div>
    );
  }
);

MaskedAvsInput.displayName = 'MaskedAvsInput';