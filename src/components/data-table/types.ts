import type { ColumnDef } from '@tanstack/react-table';

// ---------------------------------------------------------------------------
// DataTableColumn<T>
//
// Thin alias over TanStack Table's ColumnDef so feature phases can type
// their column arrays without importing from @tanstack/react-table directly.
// The generic T is the row data type.
// ---------------------------------------------------------------------------

export type DataTableColumn<T> = ColumnDef<T>;

// ---------------------------------------------------------------------------
// DataTableQuery
//
// The query-state shape that every DataTable syncs to URL search params.
// Field names mirror the generated list-op query args used across all
// paginated list endpoints:
//
//   page        → ?page=N         (1-based, per DRF PageNumberPagination)
//   pageSize    → ?page_size=N
//   ordering    → ?ordering=field (prefix "-" for descending)
//   search      → ?search=text
//
// Consuming hooks receive a DataTableQuery and spread its fields into the
// generated list-op's `query` parameter. A null field means "omit from
// query string" — the backend will use its default.
// ---------------------------------------------------------------------------

export interface DataTableQuery {
  page: number;
  pageSize: number;
  ordering: string | null;
  search: string | null;
}

export const DEFAULT_DATA_TABLE_QUERY: DataTableQuery = {
  page: 1,
  pageSize: 20,
  ordering: null,
  search: null,
};
