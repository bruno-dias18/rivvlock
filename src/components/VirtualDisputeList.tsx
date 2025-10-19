import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AdminDisputeCard } from './AdminDisputeCard';
import { LocalErrorBoundary } from './LocalErrorBoundary';

interface VirtualDisputeListProps {
  disputes: any[];
  onRefetch: () => void;
}

/**
 * Virtual scrolling list for disputes to optimize rendering performance
 * Only renders visible items in the viewport
 */
export function VirtualDisputeList({ disputes, onRefetch }: VirtualDisputeListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: disputes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 400, // Estimated dispute card height
    overscan: 2, // Render 2 extra items above/below viewport
  });

  const items = virtualizer.getVirtualItems();

  return (
    <LocalErrorBoundary>
      <div
        ref={parentRef}
        className="space-y-4 overflow-auto"
        style={{ height: '100%', maxHeight: 'calc(100vh - 400px)' }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {items.map((virtualItem) => {
            const dispute = disputes[virtualItem.index];
            return (
              <div
                key={dispute.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <AdminDisputeCard
                  dispute={dispute}
                  onRefetch={onRefetch}
                />
              </div>
            );
          })}
        </div>
      </div>
    </LocalErrorBoundary>
  );
}
