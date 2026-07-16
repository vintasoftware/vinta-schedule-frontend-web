'use client';

import * as React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from 'vinta-schedule-design-system/ui/table';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { DataTableToolbar } from './data-table-toolbar';
import { DataTablePagination } from './data-table-pagination';
import {
  VStack,
  Box,
  Flex,
  Center,
  Text,
} from 'vinta-schedule-design-system/layout';
import { cn } from '@/lib/utils/index';
import type { DataTableColumn, DataTableQuery } from './types';

// ---------------------------------------------------------------------------
// DataTable<T>
//
// Generic server-driven table. It does NOT sort/filter/paginate client-side.
// It renders whatever `data` it is given and surfaces state changes via the
// `onQueryChange` callback (which callers wire to useDataTableQuery).
//
// Props
// ─────
//   data          – current page rows
//   columns       – TanStack ColumnDef<T> array (use DataTableColumn<T>)
//   query         – current DataTableQuery (page, pageSize, ordering, search)
//   onQueryChange – called whenever the user interacts with sort/search/page
//   totalCount    – total items from the API (for pagination)
//   isLoading     – renders skeleton rows instead of data
//   emptyState    – ReactNode shown when data is empty and not loading
//   toolbarActions – extra elements in the toolbar's right slot
//   className     – root class override
// ---------------------------------------------------------------------------

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  query: DataTableQuery;
  onQueryChange: (query: DataTableQuery) => void;
  /** Total number of items (from the API response). */
  totalCount: number;
  /** When true renders skeleton loading rows instead of data. */
  isLoading?: boolean;
  /** Rendered when data is empty and isLoading is false. */
  emptyState?: React.ReactNode;
  /** Extra toolbar content (e.g. filter buttons, action buttons). */
  toolbarActions?: React.ReactNode;
  /**
   * Whether to show the search input in the toolbar. Defaults to true.
   * Pass false for APIs that do not support a search/filter parameter
   * (e.g. /organization-members/ — limit/offset only).
   */
  showSearch?: boolean;
  /** Number of skeleton rows to show while loading. Defaults to 5. */
  skeletonRows?: number;
  /** Whether the table header should be sticky. Defaults to false. */
  stickyHeader?: boolean;
  className?: string;
}

/** Convert the DataTableQuery ordering string ↔ TanStack SortingState. */
function queryOrderingToSorting(ordering: string | null): SortingState {
  if (!ordering) return [];
  const desc = ordering.startsWith('-');
  const id = desc ? ordering.slice(1) : ordering;
  return [{ id, desc }];
}

function sortingToQueryOrdering(sorting: SortingState): string | null {
  if (!sorting.length) return null;
  const { id, desc } = sorting[0];
  return desc ? `-${id}` : id;
}

function SortIcon({
  isSorted,
}: {
  isSorted: false | 'asc' | 'desc';
}): React.ReactElement {
  if (isSorted === 'asc') {
    return <Icon icon={ArrowUp} size='sm' />;
  }
  if (isSorted === 'desc') {
    return <Icon icon={ArrowDown} size='sm' />;
  }
  // The idle arrow is deliberately half-strength; an alpha tint of a token has
  // no prop form, so the class stays.
  return (
    <Icon icon={ArrowUpDown} size='sm' className='text-muted-foreground/50' />
  );
}

export function DataTable<T>({
  data,
  columns,
  query,
  onQueryChange,
  totalCount,
  isLoading = false,
  emptyState,
  toolbarActions,
  showSearch = true,
  skeletonRows = 5,
  stickyHeader = false,
  className,
}: DataTableProps<T>) {
  // Map the DataTableQuery ordering field → TanStack SortingState.
  // TanStack Table is used only for column management; server drives the data.
  const sorting: SortingState = queryOrderingToSorting(query.ordering);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    // Server-side: TanStack must NOT attempt client-side sorting.
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    // DRF supports only a single ordering field; prevent shift-click multi-sort.
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onQueryChange({
        ...query,
        ordering: sortingToQueryOrdering(next),
        page: 1, // reset to page 1 on sort change
      });
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  const isEmpty = !isLoading && data.length === 0;

  return (
    // `className` is a public prop of this component — it is forwarded, not
    // authored here.
    <VStack data-slot='data-table' className={className}>
      {/* Toolbar */}
      <DataTableToolbar
        search={query.search}
        onSearchChange={(value) =>
          onQueryChange({ ...query, search: value, page: 1 })
        }
        actions={toolbarActions}
        showSearch={showSearch}
      />

      {/* Table */}
      <Box radius='md' border overflow='hidden'>
        <Table>
          <TableHeader
            // shadcn <thead> atom — it takes no box props, so the sticky chrome
            // has no prop form here.
            className={cn(stickyHeader && 'bg-background sticky top-0 z-10')}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      // :hover variant + cursor/user-select on a shadcn <th>:
                      // none of these have a prop form.
                      className={cn(
                        canSort &&
                          'hover:text-foreground cursor-pointer select-none'
                      )}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                      aria-sort={
                        isSorted === 'asc'
                          ? 'ascending'
                          : isSorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : (
                        <Flex as='span' inline align='center' gap={1}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {canSort && <SortIcon isSorted={isSorted} />}
                        </Flex>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {isLoading ? (
              // Skeleton rows while data is loading
              Array.from({ length: skeletonRows }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`} aria-hidden>
                  {table.getAllColumns().map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton height={20} width='full' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isEmpty ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={columns.length}>
                  <Center height={128} textAlign='center'>
                    {emptyState ?? (
                      <Text size='sm' color='muted-foreground'>
                        No results found.
                      </Text>
                    )}
                  </Center>
                </TableCell>
              </TableRow>
            ) : (
              // Data rows
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Box>

      {/* Pagination */}
      <DataTablePagination
        page={query.page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={query.pageSize}
        onPageChange={(p) => onQueryChange({ ...query, page: p })}
      />
    </VStack>
  );
}
