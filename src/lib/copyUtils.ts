import { logger } from '@/lib/logger';

interface CopyOptions {
  inputRef?: React.RefObject<HTMLInputElement>;
  fallbackToPrompt?: boolean;
}

interface CopyResult {
  success: boolean;
  method: 'clipboard' | 'execCommand' | 'textarea' | 'prompt' | 'share' | 'failed' | 'none';
  error?: string;
}

export const copyToClipboard = async (text: string, options: CopyOptions = {}): Promise<CopyResult> => {
  const { inputRef, fallbackToPrompt = true } = options;
  
  // Environment detection
  const isInIframe = window.top !== window;
  const isSecureContext = window.isSecureContext;
  
  logger.debug('[COPY] Environment:', { isInIframe, isSecureContext, hasClipboard: !!navigator.clipboard });

  // Method 1: Modern Clipboard API (most reliable when available)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      logger.debug('[COPY] Success with Clipboard API');
      return { success: true, method: 'clipboard' };
    } catch (error) {
      logger.debug('[COPY] Clipboard API failed:', error);
    }
  }

  // Method 2: Use existing input selection + execCommand (if input ref provided)
  if (inputRef?.current && document.execCommand) {
    try {
      inputRef.current.select();
      inputRef.current.setSelectionRange(0, text.length);
      const successful = document.execCommand('copy');
      if (successful) {
        logger.debug('[COPY] Success with execCommand on existing input');
        return { success: true, method: 'execCommand' };
      }
    } catch (error) {
      logger.debug('[COPY] execCommand on input failed:', error);
    }
  }

  // Method 3: Create temporary textarea + execCommand
  if (document.execCommand) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.style.opacity = '0';
      
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        logger.debug('[COPY] Success with temporary textarea');
        return { success: true, method: 'textarea' };
      }
    } catch (error) {
      logger.debug('[COPY] Temporary textarea failed:', error);
    }
  }

  // Method 4: Ultimate fallback - prompt user to copy manually
  if (fallbackToPrompt) {
    try {
      const userChoice = window.prompt('Copiez ce lien manuellement (Ctrl+C ou Cmd+C):', text);
      if (userChoice !== null) {
        logger.debug('[COPY] User used manual prompt');
        return { success: true, method: 'prompt' };
      }
    } catch (error) {
      logger.debug('[COPY] Prompt fallback failed:', error);
    }
  }

  logger.debug('[COPY] All methods failed');
  return { 
    success: false, 
    method: 'none', 
    error: 'Toutes les méthodes de copie ont échoué' 
  };
};

// Mobile share fallback (bonus feature)
export const shareOrCopy = async (text: string, title: string = '', options: CopyOptions = {}): Promise<CopyResult> => {
  // Environment detection for better mobile handling
  const isInIframe = window.top !== window;
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  logger.debug('[SHARE] Environment:', { isMobile, isIOS, isInIframe, hasShare: !!navigator.share });

  // Try native sharing first on mobile (prioritize on iOS and when not in iframe)
  if (navigator.share && isMobile && !isInIframe) {
    try {
      await navigator.share({
        title,
        text: title,
        url: text
      });
      logger.debug('[SHARE] Success with native share');
      return { success: true, method: 'share' }; // Return 'share' to differentiate from clipboard
    } catch (error) {
      logger.debug('[SHARE] Native share failed, falling back to copy:', error);
    }
  }

  // Fallback to copy with improved mobile handling
  return copyToClipboard(text, options);
};