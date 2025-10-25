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
    // Auto-formatte pendant la saisie - utilisateur ne tape que les chiffres
    const formatAvsValue = (digits: string): string => {
      // Remove all non-digits
      const cleaned = digits.replace(/\D/g, '');
      
      // Empty input
      if (cleaned.length === 0) return '';
      
      // Always ensure 756 prefix
      let finalDigits = cleaned;
      if (!cleaned.startsWith('756')) {
        // Auto-prepend 756 si l'user commence par autre chose
        finalDigits = '756' + cleaned.slice(0, 10);
      }
      
      // Limit to 13 digits maximum
      finalDigits = finalDigits.slice(0, 13);
      
      // Apply formatting progressively: 756.XXXX.XXXX.XX
      if (finalDigits.length <= 3) return finalDigits;
      if (finalDigits.length <= 7) return `${finalDigits.slice(0, 3)}.${finalDigits.slice(3)}`;
      if (finalDigits.length <= 11) return `${finalDigits.slice(0, 3)}.${finalDigits.slice(3, 7)}.${finalDigits.slice(7)}`;
      return `${finalDigits.slice(0, 3)}.${finalDigits.slice(3, 7)}.${finalDigits.slice(7, 11)}.${finalDigits.slice(11)}`;
    };

    // Extract only digits from input
    const extractDigits = (input: string): string => {
      return input.replace(/\D/g, '');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      let digits = extractDigits(inputValue);
      
      // Si l'user efface tout, autoriser
      if (digits.length === 0) {
        setDisplayValue('');
        onChange?.('');
        return;
      }
      
      // Auto-prepend 756 si l'user tape autre chose
      if (!digits.startsWith('756')) {
        digits = '756' + digits.slice(0, 10);
      }
      
      // Limit to 13 digits maximum
      const limitedDigits = digits.slice(0, 13);
      const formatted = formatAvsValue(limitedDigits);
      
      setDisplayValue(formatted);
      // Toujours envoyer les chiffres sans points à la DB
      onChange?.(limitedDigits);
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
      // Pas de pré-remplissage au focus - l'user tape directement
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
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