import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard height on mobile devices
 * Uses VisualViewport API for accurate keyboard detection
 */
export function useKeyboardInsets() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const visualViewport = (window as any).visualViewport as VisualViewport | undefined;
    
    if (!visualViewport) {
      return;
    }
    
    const updateInset = () => {
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop
      );
      setBottomInset(Math.max(0, keyboardHeight));
    };

    // Update on initial mount
    updateInset();

    // Listen for viewport changes
    visualViewport.addEventListener('resize', updateInset);
    visualViewport.addEventListener('scroll', updateInset);

    return () => {
      visualViewport.removeEventListener('resize', updateInset);
      visualViewport.removeEventListener('scroll', updateInset);
    };
  }, []);

  return bottomInset;
}
