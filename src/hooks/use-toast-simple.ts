import { useState, useCallback, useEffect } from 'react';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface Toast extends ToastOptions {
  id: string;
  open: boolean;
}

let toastCounter = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let toastsState: Toast[] = [];

const generateId = () => {
  toastCounter += 1;
  return `toast-${toastCounter}`;
};

const updateListeners = () => {
  listeners.forEach(listener => listener([...toastsState]));
};

const addToast = (options: ToastOptions): string => {
  const id = generateId();
  const newToast: Toast = {
    ...options,
    id,
    open: true,
    duration: options.duration || 5000
  };
  
  toastsState = [...toastsState, newToast];
  updateListeners();
  
  // Auto remove after duration
  if (newToast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);
  }
  
  return id;
};

const removeToast = (id: string) => {
  toastsState = toastsState.filter(toast => toast.id !== id);
  updateListeners();
};

const dismissToast = (id: string) => {
  toastsState = toastsState.map(toast => 
    toast.id === id ? { ...toast, open: false } : toast
  );
  updateListeners();
  
  // Remove after animation
  setTimeout(() => removeToast(id), 150);
};

export const toast = (options: ToastOptions) => {
  return addToast(options);
};

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>(toastsState);
  
  const subscribe = useCallback((listener: (toasts: Toast[]) => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);
  
  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return () => {
      unsubscribe();
    };
  }, [subscribe]);
  
  const dismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);
  
  return {
    toasts,
    toast,
    dismiss
  };
};