import React, { useState, forwardRef } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface MaskedSiretInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export const MaskedSiretInput = forwardRef<HTMLInputElement, MaskedSiretInputProps>(
  ({ value = '', onChange, className, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);

    // Format SIRET with spaces for readability (XXX XXX XXX XXXXX)
    const formatSiretValue = (digits: string): string => {
      // Remove all non-digits
      const cleaned = digits.replace(/\D/g, '');
      
      // Apply formatting: XXX XXX XXX XXXXX
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      if (cleaned.length <= 9) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 14)}`;
    };

    // Extract only digits from input
    const extractDigits = (input: string): string => {
      return input.replace(/\D/g, '');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const digits = extractDigits(inputValue);
      
      // Limit to 14 digits maximum
      const limitedDigits = digits.slice(0, 14);
      const formatted = formatSiretValue(limitedDigits);
      
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
      
      // Prevent input if already at 14 digits
      const currentDigits = extractDigits(displayValue);
      if (currentDigits.length >= 14 && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    // Update display value when prop value changes
    React.useEffect(() => {
      if (value !== undefined) {
        setDisplayValue(formatSiretValue(value));
      }
    }, [value]);

    const currentDigits = extractDigits(displayValue);
    const isValid = currentDigits.length === 14;
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
          placeholder="123 456 789 12345"
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
            {isEmpty ? "14 chiffres requis" : isValid ? "Format valide" : "Format invalide"}
          </span>
          <span className={cn(
            "transition-colors",
            currentDigits.length === 14 ? "text-green-600" : 
            currentDigits.length > 10 ? "text-orange-600" : "text-muted-foreground"
          )}>
            {currentDigits.length}/14
          </span>
        </div>
      </div>
    );
  }
);

MaskedSiretInput.displayName = 'MaskedSiretInput';