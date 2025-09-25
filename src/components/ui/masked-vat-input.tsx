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
      
      // If input is empty, clear everything
      if (!newValue) {
        setDisplayValue("")
        onChange?.("")
        return
      }
      
      // If field was empty and user typed digits, format with prefix
      if (!displayValue && /^\d/.test(newValue)) {
        const digits = newValue.replace(/\D/g, '')
        const formatted = formatDisplayValue(digits)
        setDisplayValue(formatted)
        onChange?.(formatted)
        return
      }
      
      // Always extract digits from the new value and reformat, do not block user edits
      const digits = extractDigits(newValue)
      const formatted = formatDisplayValue(digits)
      setDisplayValue(formatted)
      onChange?.(formatted)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const input = e.currentTarget
      
      // If field is empty, allow normal input
      if (!displayValue) return
      
      const prefix = getPrefix()
      const suffix = getSuffix()
      
      // Prevent cursor from going into prefix area
      if (e.key === 'ArrowLeft' || e.key === 'Home') {
        setTimeout(() => {
          if (input.selectionStart !== null && input.selectionStart < prefix.length) {
            input.setSelectionRange(prefix.length, prefix.length)
          }
        }, 0)
      }

      // Prevent cursor from going into suffix area
      if (e.key === 'ArrowRight' || e.key === 'End') {
        setTimeout(() => {
          const maxPos = displayValue.length - suffix.length
          if (input.selectionStart !== null && input.selectionStart > maxPos) {
            input.setSelectionRange(maxPos, maxPos)
          }
        }, 0)
      }

      // Handle deletion: allow clearing when the editable part is fully selected; protect prefix from char-by-char deletion
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0
        const editableStart = prefix.length
        const editableEnd = displayValue.length - suffix.length

        // If full editable range is selected, clear everything
        if (start <= editableStart && end >= editableEnd) {
          setDisplayValue("")
          onChange?.("")
          e.preventDefault()
          return
        }

        // Prevent deleting into the prefix when no selection
        if (e.key === 'Backspace' && start <= editableStart && start === end) {
          e.preventDefault()
          setTimeout(() => {
            input.setSelectionRange(editableStart, editableStart)
          }, 0)
        }
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true)
      
      // Only position cursor if there's already content
      if (displayValue) {
        const prefix = getPrefix()
        const suffix = getSuffix()
        setTimeout(() => {
          const input = e.currentTarget
          const start = prefix.length
          const end = displayValue.length - suffix.length
          input.setSelectionRange(start, Math.max(start, end))
        }, 0)
      }
      
      onFocus?.(e)
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
        onBlur={handleBlur}
        {...props}
      />
    )
  }
)

MaskedVatInput.displayName = "MaskedVatInput"

export { MaskedVatInput }