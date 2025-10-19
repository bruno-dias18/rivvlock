import { useState, useMemo } from 'react';

export interface PaginationConfig {
  pageSize?: number;
  initialPage?: number;
}

export interface PaginationResult<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedData: T[];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
}

/**
 * Generic client-side pagination hook
 * @param data - Full dataset to paginate
 * @param config - Pagination configuration
 */
export function usePagination<T>(
  data: T[] | undefined,
  config: PaginationConfig = {}
): PaginationResult<T> {
  const { pageSize = 20, initialPage = 1 } = config;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalItems = data?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    if (!data) return [];
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, currentPage, pageSize]);

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedData,
    goToPage,
    nextPage,
    prevPage,
    canGoNext: currentPage < totalPages,
    canGoPrev: currentPage > 1,
  };
}
