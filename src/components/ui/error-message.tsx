/**
 * Error message component with consistent styling
 * Use this instead of raw toast messages for better UX
 */

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription, AlertTitle } from './alert';

interface ErrorMessageProps {
  title?: string;
  message: string;
  retry?: () => void;
  variant?: 'destructive' | 'default';
}

export const ErrorMessage = ({ 
  title = 'Error', 
  message, 
  retry,
  variant = 'destructive' 
}: ErrorMessageProps) => {
  return (
    <Alert variant={variant}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        {message}
        {retry && (
          <Button
            variant="outline"
            size="sm"
            onClick={retry}
            className="mt-3"
          >
            <RefreshCw className="h-3 w-3 mr-2" />
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
};

/**
 * Inline error message (for forms)
 */
interface InlineErrorProps {
  message?: string;
}

export const InlineError = ({ message }: InlineErrorProps) => {
  if (!message) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm text-destructive mt-1">
      <AlertCircle className="h-3 w-3" />
      <span>{message}</span>
    </div>
  );
};
