import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  totalCount: number;
  pageSize: number;
  isMobile?: boolean;
}

/**
 * Pagination controls for transaction list
 * Extracted from monolithic component for better reusability
 */
export function PaginationControls({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  totalCount,
  pageSize,
  isMobile = false,
}: PaginationControlsProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center ${isMobile ? 'justify-center' : 'justify-between'} px-4 py-3 border-t`}>
      {!isMobile && (
        <div className="text-sm text-muted-foreground">
          Affichage de {startItem} à {endItem} sur {totalCount} transactions
        </div>
      )}
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
          className={isMobile ? 'px-2' : ''}
        >
          <ChevronLeft className="h-4 w-4" />
          {!isMobile && 'Précédent'}
        </Button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <Button
                key={pageNum}
                variant={currentPage === pageNum ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className="w-9"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className={isMobile ? 'px-2' : ''}
        >
          {!isMobile && 'Suivant'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
