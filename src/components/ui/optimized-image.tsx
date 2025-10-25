import { useState, useEffect, useRef } from 'react';
import { getOptimizedImageUrl, lazyLoadImage, IMAGE_SIZES, type ImageSize } from '@/lib/imageOptimization';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  size?: ImageSize;
  lazy?: boolean;
  quality?: number;
  className?: string;
}

/**
 * Optimized image component with WebP support and native lazy loading
 * 
 * #4 IMPROVEMENT: Uses native loading="lazy" for better performance
 */
export function OptimizedImage({
  src,
  alt,
  size = 'medium',
  lazy = true,
  quality = 85,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const optimizedSrc = getOptimizedImageUrl(src, {
    width: IMAGE_SIZES[size],
    quality,
    format: 'webp',
  });

  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    const cleanup = lazyLoadImage(imgRef.current);
    return cleanup;
  }, [lazy]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
    setIsLoaded(true);
  };

  if (error) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
        {...props}
      >
        <span className="text-sm">Image non disponible</span>
      </div>
    );
  }

  return (
    <>
      {!isLoaded && (
        <div
          className={cn(
            "animate-pulse bg-muted",
            className
          )}
          style={{ aspectRatio: props.style?.aspectRatio }}
        />
      )}
      <img
        ref={imgRef}
        src={lazy ? undefined : optimizedSrc}
        data-src={lazy ? optimizedSrc : undefined}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          lazy && "lazy",
          className
        )}
        {...props}
      />
    </>
  );
}
