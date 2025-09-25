import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface MaskedUidInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

const MaskedUidInput = React.forwardRef<HTMLInputElement, MaskedUidInputProps>(
  ({ className, value = '', onChange, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    React.useEffect(() => {
      setDisplayValue(value);
    }, [value]);

    const formatUidValue = (digits: string) => {
      // Limit to 9 digits max
      const limitedDigits = digits.slice(0, 9);
      
      if (limitedDigits.length === 0) {
        return '';
      }

      // Format as CHE-XXX.XXX.XXX
      let formatted = 'CHE-';
      
      if (limitedDigits.length > 0) {
        formatted += limitedDigits.slice(0, 3);
      }
      if (limitedDigits.length > 3) {
        formatted += '.' + limitedDigits.slice(3, 6);
      }
      if (limitedDigits.length > 6) {
        formatted += '.' + limitedDigits.slice(6, 9);
      }

      return formatted;
    };

    const extractDigits = (input: string) => {
      return input.replace(/\D/g, '');
    };

    const getDigitCount = (formatted: string) => {
      return extractDigits(formatted).length;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      // Extract only digits
      const digits = extractDigits(newValue);
      
      // If no digits, clear completely
      if (digits.length === 0) {
        setDisplayValue('');
        onChange?.('');
        return;
      }

      // Format and update
      const formatted = formatUidValue(digits);
      setDisplayValue(formatted);
      onChange?.(formatted);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      
      // Allow Ctrl+A to select all
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        if (displayValue) {
          e.preventDefault();
          input.setSelectionRange(0, displayValue.length);
        }
        return;
      }

      // Protect CHE- prefix from deletion
      if ((e.key === 'Backspace' || e.key === 'Delete') && displayValue) {
        const start = input.selectionStart ?? 0;
        const end = input.selectionEnd ?? 0;
        
        // If trying to delete the CHE- prefix
        if (e.key === 'Backspace' && start <= 4 && start === end) {
          e.preventDefault();
          return;
        }
        
        // If selection includes the prefix, prevent partial deletion
        if (start < 4 && end > start) {
          e.preventDefault();
          // Clear all digits but keep CHE- format
          const digits = extractDigits(displayValue);
          if (digits.length > 0) {
            setDisplayValue('');
            onChange?.('');
          }
          return;
        }
      }

      // Prevent cursor from going before CHE-
      if (e.key === 'ArrowLeft' || e.key === 'Home') {
        setTimeout(() => {
          if (displayValue && input.selectionStart !== null && input.selectionStart < 4) {
            input.setSelectionRange(4, 4);
          }
        }, 0);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      
      // If empty field and user focuses, show CHE- prefix
      if (!displayValue) {
        setDisplayValue('CHE-');
        onChange?.('CHE-');
        setTimeout(() => {
          const input = e.currentTarget;
          input.setSelectionRange(4, 4);
        }, 0);
      } else {
        // Position cursor after CHE- if clicking in prefix area
        setTimeout(() => {
          const input = e.currentTarget;
          if (input.selectionStart !== null && input.selectionStart < 4) {
            input.setSelectionRange(4, 4);
          }
        }, 0);
      }
      
      onFocus?.(e);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      
      // Prevent clicking in the CHE- prefix area
      setTimeout(() => {
        if (displayValue && input.selectionStart !== null && input.selectionStart < 4) {
          input.setSelectionRange(4, 4);
        }
      }, 0);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      
      // If only CHE- remains, clear the field
      if (displayValue === 'CHE-') {
        setDisplayValue('');
        onChange?.('');
      }
      
      onBlur?.(e);
    };

    const digitCount = getDigitCount(displayValue);
    const isValidLength = digitCount === 9;
    const showCounter = isFocused && digitCount > 0 && digitCount < 9;

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            !isValidLength && digitCount > 0 && 'border-yellow-500 focus-visible:ring-yellow-500',
            digitCount === 9 && 'border-green-500 focus-visible:ring-green-500',
            className
          )}
          value={displayValue}
          placeholder="CHE-123.456.789"
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onMouseDown={handleMouseDown}
          onBlur={handleBlur}
          {...props}
        />
        {showCounter && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {digitCount}/9
          </div>
        )}
      </div>
    );
  }
);

MaskedUidInput.displayName = 'MaskedUidInput';

export { MaskedUidInput };
