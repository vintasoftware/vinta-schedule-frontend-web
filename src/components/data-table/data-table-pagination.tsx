'use client';

import * as React from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Flex } from '@/components/layout';
import { cn } from '@/lib/utils/index';

// ---------------------------------------------------------------------------
// DataTablePagination
//
// Wraps the shadcn Pagination primitive with server-driven page logic.
// It renders Previous/Next and up to `windowSize` page links centred on
// the current page. All navigation is done by calling onPageChange (which
// in practice updates the URL via useDataTableQuery).
// ---------------------------------------------------------------------------

export interface DataTablePaginationProps {
  /** Current 1-based page number. */
  page: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total number of items (used to display a summary). */
  totalCount: number;
  /** Number of rows on this page (used for "Showing X–Y of Z"). */
  pageSize: number;
  /** Called when the user clicks a page control. */
  onPageChange: (page: number) => void;
  /** How many page-number links to show around the current page. Defaults to 5. */
  windowSize?: number;
  className?: string;
}

/** Build an array of page numbers + "ellipsis" markers to render. */
function buildPageWindow(
  current: number,
  total: number,
  windowSize: number
): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
  if (total <= windowSize) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, current - half);
  const end = Math.min(total, start + windowSize - 1);

  // Clamp so we always show `windowSize` entries when possible.
  if (end - start + 1 < windowSize) {
    start = Math.max(1, end - windowSize + 1);
  }

  const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [];

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis-start');
  }

  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  if (end < total) {
    if (end < total - 1) pages.push('ellipsis-end');
    pages.push(total);
  }

  return pages;
}

export function DataTablePagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  windowSize = 5,
  className,
}: DataTablePaginationProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const pageWindow = buildPageWindow(page, totalPages, windowSize);

  return (
    <Flex
      as='div'
      data-slot='data-table-pagination'
      direction='column'
      align='center'
      gap={2}
      py={2}
      // Responsive: switch to row layout at @md/content container breakpoint
      className={cn(
        '@md/content:flex-row @md/content:justify-between',
        className
      )}
    >
      {/* Row count summary */}
      <p className='text-muted-foreground text-sm'>
        {totalCount === 0
          ? 'No results'
          : `Showing ${start}–${end} of ${totalCount}`}
      </p>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {/* Previous */}
            <PaginationItem>
              <PaginationPrevious
                onClick={page > 1 ? () => onPageChange(page - 1) : undefined}
                aria-disabled={page <= 1}
                tabIndex={page <= 1 ? -1 : undefined}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {/* Page links */}
            {pageWindow.map((entry, idx) => {
              if (entry === 'ellipsis-start' || entry === 'ellipsis-end') {
                return (
                  <PaginationItem key={`${entry}-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              return (
                <PaginationItem key={entry}>
                  <PaginationLink
                    isActive={entry === page}
                    onClick={() => onPageChange(entry)}
                  >
                    {entry}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            {/* Next */}
            <PaginationItem>
              <PaginationNext
                onClick={
                  page < totalPages ? () => onPageChange(page + 1) : undefined
                }
                aria-disabled={page >= totalPages}
                tabIndex={page >= totalPages ? -1 : undefined}
                className={
                  page >= totalPages ? 'pointer-events-none opacity-50' : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </Flex>
  );
}
