/**
 * Enhanced toast hook with user-friendly error messages
 * Automatically converts technical errors to readable messages
 */

import { toast as sonnerToast } from 'sonner';
import { getUserFriendlyError, ErrorContext } from '@/lib/errorMessages';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

/**
 * Enhanced toast utilities with automatic error message conversion
 * 
 * @example
 * ```tsx
 * import { useToast } from '@/hooks/useToast';
 * 
 * const { toast } = useToast();
 * 
 * try {
 *   await riskyOperation();
 *   toast.success('Operation completed');
 * } catch (error) {
 *   toast.error(error); // Automatically converts to user-friendly message
 * }
 * ```
 */
export const useToast = () => {
  return {
    toast: {
      /**
       * Show success message
       */
      success: (message: string, options?: ToastOptions) => {
        sonnerToast.success(options?.title || 'Succès', {
          description: message,
          duration: options?.duration,
        });
      },

      /**
       * Show error message
       * Automatically converts technical errors to user-friendly messages
       */
      error: (error: unknown, context?: ErrorContext) => {
        const friendlyMessage = getUserFriendlyError(error, context);
        sonnerToast.error('Erreur', {
          description: friendlyMessage,
          duration: 5000,
        });
      },

      /**
       * Show warning message
       */
      warning: (message: string, options?: ToastOptions) => {
        sonnerToast.warning(options?.title || 'Attention', {
          description: message,
          duration: options?.duration || 4000,
        });
      },

      /**
       * Show info message
       */
      info: (message: string, options?: ToastOptions) => {
        sonnerToast.info(options?.title || 'Information', {
          description: message,
          duration: options?.duration || 3000,
        });
      },

      /**
       * Show loading message with promise
       * Automatically handles success/error states
       */
      promise: <T>(
        promise: Promise<T>,
        messages: {
          loading: string;
          success: string | ((data: T) => string);
          error?: string | ((error: unknown) => string);
        }
      ) => {
        return sonnerToast.promise(promise, {
          loading: messages.loading,
          success: messages.success,
          error: (error) => {
            if (messages.error) {
              return typeof messages.error === 'function'
                ? messages.error(error)
                : messages.error;
            }
            return getUserFriendlyError(error);
          },
        });
      },
    },
  };
};

// Re-export for convenience
export { toast } from 'sonner';
