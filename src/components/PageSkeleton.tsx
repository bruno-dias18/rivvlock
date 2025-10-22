import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page loading skeleton
 * Used as Suspense fallback for lazy-loaded pages
 */
export const PageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
};
