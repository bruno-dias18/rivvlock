import * as React from "react"
import { cn } from "@/lib/utils"

export interface MaskedVatInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  country: 'FR' | 'CH'
  value?: string
  onChange?: (value: string) => void
}

const MaskedVatInput = React.forwardRef<HTMLInputElement, MaskedVatInputProps>(
  ({ className, country, value = "", onChange, onFocus, onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("")
    const [isFocused, setIsFocused] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!, [])

    const getPrefix = () => {
      return country === 'CH' ? 'CHE-' : 'FR'
    }

    const getSuffix = () => {
      return country === 'CH' ? ' TVA' : ''
    }

    const formatSwissVat = (digits: string) => {
      // Format: CHE-XXX.XXX.XXX TVA
      const cleaned = digits.replace(/\D/g, '')
      if (cleaned.length <= 3) return cleaned
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`
      if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}`
    }

    const formatFrenchVat = (digits: string) => {
      // Format: FRXXXXXXXXXXX (11 digits after FR)
      const cleaned = digits.replace(/\D/g, '')
      return cleaned.slice(0, 11)
    }

    const extractDigits = (vatValue: string) => {
      if (country === 'CH') {
        // Extract digits from CHE-XXX.XXX.XXX TVA format
        return vatValue.replace(/CHE-|\s*TVA|\./g, '').replace(/\D/g, '')
      } else {
        // Extract digits from FRXXXXXXXXXXX format
        return vatValue.replace(/^FR/i, '').replace(/\D/g, '')
      }
    }

    const formatDisplayValue = (digits: string) => {
      // If no digits, return empty string
      if (!digits) return ""
      
      const prefix = getPrefix()
      const suffix = getSuffix()
      
      if (country === 'CH') {
        const formatted = formatSwissVat(digits)
        return `${prefix}${formatted}${suffix}`
      } else {
        const formatted = formatFrenchVat(digits)
        return `${prefix}${formatted}`
      }
    }

    // Update display value when external value changes
    React.useEffect(() => {
      if (value) {
        const digits = extractDigits(value)
        setDisplayValue(formatDisplayValue(digits))
      } else {
        setDisplayValue(formatDisplayValue(""))
      }
    }, [value, country])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      
      // Extract only digits from any input
      const digits = newValue.replace(/\D/g, '')
      
      // If no digits, clear completely
      if (digits.length === 0) {
        setDisplayValue("")
        onChange?.("")
        return
      }
      
      // Format and update with new digits
      const formatted = formatDisplayValue(digits)
      setDisplayValue(formatted)
      onChange?.(formatted)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow Ctrl+A to select all editable content
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        if (displayValue) {
          e.preventDefault()
          const input = e.currentTarget
          input.setSelectionRange(0, displayValue.length)
        }
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      
      // Select all content if there's a value for easy replacement
      if (displayValue) {
        setTimeout(() => {
          const input = e.currentTarget
          input.setSelectionRange(0, displayValue.length)
        }, 0)
      }
      
      onFocus?.(e)
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      // On first click in a filled field, select all for easy replacement
      if (displayValue && !isFocused) {
        e.preventDefault()
        const input = e.currentTarget
        input.focus()
        setTimeout(() => {
          input.setSelectionRange(0, displayValue.length)
        }, 0)
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false)
      onBlur?.(e)
    }

    return (
      <input
        ref={inputRef}
        type="text"
        placeholder={country === 'CH' ? 'CHE-123.456.789 TVA' : 'FR12345678901'}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={displayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onMouseDown={handleMouseDown}
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

MaskedVatInput.displayName = "MaskedVatInput"

export { MaskedVatInput }