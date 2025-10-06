import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard height on mobile devices
 * Uses VisualViewport API for accurate keyboard detection
 */
export function useKeyboardInsets() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const visualViewport = (window as any).visualViewport as VisualViewport | undefined;
    let rafId: number | null = null;

    const computeKeyboardHeight = () => {
      if (!visualViewport) return 0;
      return Math.max(
        0,
        window.innerHeight - visualViewport.height - visualViewport.offsetTop
      );
    };

    const updateInset = () => {
      const height = computeKeyboardHeight();
      setBottomInset(height);
    };

    const onChange = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateInset);
    };

    // Initial update
    updateInset();

    // Listen for viewport changes and window resize as fallback
    if (visualViewport) {
      visualViewport.addEventListener('resize', onChange);
      visualViewport.addEventListener('scroll', onChange);
    }
    window.addEventListener('resize', onChange);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', onChange);
        visualViewport.removeEventListener('scroll', onChange);
      }
      window.removeEventListener('resize', onChange);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return bottomInset;
}
