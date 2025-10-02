import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard height on mobile devices
 * Uses VisualViewport API with Brave browser fallback
 * Safari: Works perfectly with VisualViewport
 * Brave: Uses window resize fallback
 */
export function useKeyboardInsets() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    // Detect if we're on Brave browser
    const isBrave = !!(navigator as any).brave && typeof (navigator as any).brave.isBrave === 'function';
    
    const visualViewport = (window as any).visualViewport as VisualViewport | undefined;
    
    if (!visualViewport) {
      return;
    }

    // Store initial window height for Brave fallback
    const initialWindowHeight = window.innerHeight;
    
    const updateInset = () => {
      if (isBrave) {
        // Brave fallback: use window height difference
        // When keyboard opens, window.innerHeight decreases
        const currentHeight = window.innerHeight;
        const heightDiff = initialWindowHeight - currentHeight;
        const keyboardHeight = Math.max(0, heightDiff);
        setBottomInset(keyboardHeight);
      } else {
        // Safari and other browsers: use VisualViewport (original behavior)
        const keyboardHeight = Math.max(
          0,
          window.innerHeight - visualViewport.height - visualViewport.offsetTop
        );
        setBottomInset(Math.max(0, keyboardHeight));
      }
    };

    // Update on initial mount
    updateInset();

    // Listen for viewport changes
    visualViewport.addEventListener('resize', updateInset);
    visualViewport.addEventListener('scroll', updateInset);
    
    // For Brave: also listen to window resize
    if (isBrave) {
      window.addEventListener('resize', updateInset);
    }

    return () => {
      visualViewport.removeEventListener('resize', updateInset);
      visualViewport.removeEventListener('scroll', updateInset);
      if (isBrave) {
        window.removeEventListener('resize', updateInset);
      }
    };
  }, []);

  return bottomInset;
}
