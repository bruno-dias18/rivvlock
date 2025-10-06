import { useEffect, useState } from 'react';

/**
 * Hook to detect keyboard height on mobile devices
 * Uses VisualViewport API for accurate keyboard detection
 */
export function useKeyboardInsets() {
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const visualViewport = (window as any).visualViewport as VisualViewport | undefined;
    const initialInnerHeight = window.innerHeight;
    let rafId: number | null = null;

    const computeKeyboardHeight = () => {
      let vvHeight = 0;
      if (visualViewport) {
        vvHeight = Math.max(
          0,
          window.innerHeight - visualViewport.height - visualViewport.offsetTop
        );
      }
      const innerHeightDelta = Math.max(0, initialInnerHeight - window.innerHeight);
      return Math.max(vvHeight, innerHeightDelta);
    };

    const updateInset = () => {
      const height = computeKeyboardHeight();
      const filtered = height > 6 ? height : 0; // filter small jitters
      setBottomInset(filtered);
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
