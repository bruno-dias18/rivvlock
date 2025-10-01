import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard height on mobile devices
 * Uses VisualViewport API to calculate the space taken by the virtual keyboard
 */
export function useKeyboardInsets() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    // Check if VisualViewport API is available (modern mobile browsers)
    const visualViewport = (window as any).visualViewport as VisualViewport | undefined;
    
    if (!visualViewport) {
      return;
    }

    const updateInset = () => {
      // Calculate how much space the keyboard takes
      // When keyboard opens, visualViewport.height decreases
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop
      );
      
      setBottomInset(Math.max(0, keyboardHeight));
    };

    // Update on initial mount
    updateInset();

    // Listen for viewport changes (keyboard open/close, orientation change)
    visualViewport.addEventListener('resize', updateInset);
    visualViewport.addEventListener('scroll', updateInset);

    return () => {
      visualViewport.removeEventListener('resize', updateInset);
      visualViewport.removeEventListener('scroll', updateInset);
    };
  }, []);

  return bottomInset;
}
