import { ImgHTMLAttributes } from 'react';

interface OptimizedLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /**
   * Path to WebP logo (without extension)
   * Example: "/assets/rivvlock-logo"
   */
  src: string;
  /**
   * Alt text for accessibility
   */
  alt: string;
  /**
   * Priority loading (eager for critical images)
   */
  priority?: boolean;
}

/**
 * Optimized logo component with WebP support and PNG fallback
 * Automatically adds proper loading attributes and dimensions
 */
export function OptimizedLogo({ 
  src, 
  alt, 
  priority = false,
  className,
  width,
  height,
  ...props 
}: OptimizedLogoProps) {
  return (
    <picture>
      <source srcSet={`${src}.webp`} type="image/webp" />
      <img
        src={`${src}.png`}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        width={width}
        height={height}
        {...props}
      />
    </picture>
  );
}
