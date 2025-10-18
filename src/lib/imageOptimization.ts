/**
 * Image Optimization Utilities
 * 
 * Provides utilities for optimizing images:
 * - WebP conversion
 * - Lazy loading
 * - Responsive images
 * - Compression
 */

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(baseUrl: string, sizes: number[]): string {
  return sizes.map(size => `${baseUrl}?w=${size} ${size}w`).join(', ');
}

/**
 * Get optimized image URL with WebP format
 */
export function getOptimizedImageUrl(
  url: string,
  options: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpg' | 'png';
  } = {}
): string {
  const { width, quality = 85, format = 'webp' } = options;
  
  // If it's already a data URL or external URL, return as-is
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const params = new URLSearchParams();
  if (width) params.set('w', width.toString());
  params.set('q', quality.toString());
  params.set('f', format);

  return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
}

/**
 * Check if browser supports WebP
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  const elem = document.createElement('canvas');
  if (elem.getContext && elem.getContext('2d')) {
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
}

/**
 * Lazy load image with IntersectionObserver
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  options: IntersectionObserverInit = {}
): () => void {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const lazyImage = entry.target as HTMLImageElement;
        const src = lazyImage.dataset.src;
        const srcset = lazyImage.dataset.srcset;

        if (src) lazyImage.src = src;
        if (srcset) lazyImage.srcset = srcset;

        lazyImage.classList.remove('lazy');
        observer.unobserve(lazyImage);
      }
    });
  }, defaultOptions);

  observer.observe(img);

  // Return cleanup function
  return () => observer.disconnect();
}

/**
 * Preload critical images
 */
export function preloadImage(src: string, srcset?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => resolve();
    img.onerror = reject;
    
    if (srcset) img.srcset = srcset;
    img.src = src;
  });
}

/**
 * Convert image dimensions for responsive loading
 */
export const IMAGE_SIZES = {
  thumbnail: 150,
  small: 300,
  medium: 600,
  large: 1200,
  xlarge: 1920,
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES;
