'use client';

// ---------------------------------------------------------------------------
// useDataTableQuery
//
// Syncs DataTableQuery state to/from URL search params so that sort,
// search, and page survive navigation and can be deep-linked.
//
// URL params:
//   page        → "page"     (default: 1)
//   page_size   → "page_size" (default: pageSize arg, usually 20)
//   ordering    → "ordering" (default: null / omitted)
//   search      → "search"   (default: null / omitted)
//
// Next.js App Router note: useSearchParams() requires a Suspense boundary
// around any component that calls this hook (as per Next.js 15+ rules).
// Pages that use DataTable must wrap it in <Suspense>.
// ---------------------------------------------------------------------------

import { useCallback, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { DataTableQuery } from './types';
import { DEFAULT_DATA_TABLE_QUERY } from './types';

interface UseDataTableQueryOptions {
  /** Default page size. Defaults to 20. */
  defaultPageSize?: number;
}

interface UseDataTableQueryReturn {
  query: DataTableQuery;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setOrdering: (ordering: string | null) => void;
  setSearch: (search: string | null) => void;
  /** Reset all params to defaults. */
  reset: () => void;
  /** Whether a URL transition is in flight. */
  isPending: boolean;
}

function parseIntOrDefault(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

export function useDataTableQuery(
  options: UseDataTableQueryOptions = {}
): UseDataTableQueryReturn {
  const { defaultPageSize = DEFAULT_DATA_TABLE_QUERY.pageSize } = options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read current query state from URL.
  const query: DataTableQuery = {
    page: parseIntOrDefault(searchParams.get('page'), 1),
    pageSize: parseIntOrDefault(searchParams.get('page_size'), defaultPageSize),
    ordering: searchParams.get('ordering'),
    search: searchParams.get('search') || null,
  };

  // Build a new URLSearchParams from the current ones + overrides.
  const buildParams = useCallback(
    (overrides: Partial<Record<string, string | null>>): string => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const str = params.toString();
      return str ? `?${str}` : '';
    },
    [searchParams]
  );

  const navigate = useCallback(
    (qs: string) => {
      startTransition(() => {
        router.push(`${pathname}${qs}`);
      });
    },
    [router, pathname]
  );

  const setPage = useCallback(
    (page: number) => {
      navigate(buildParams({ page: String(page) }));
    },
    [navigate, buildParams]
  );

  const setPageSize = useCallback(
    (size: number) => {
      // Reset to page 1 when page size changes.
      navigate(buildParams({ page_size: String(size), page: '1' }));
    },
    [navigate, buildParams]
  );

  const setOrdering = useCallback(
    (ordering: string | null) => {
      // Reset to page 1 when sort changes.
      navigate(buildParams({ ordering, page: '1' }));
    },
    [navigate, buildParams]
  );

  const setSearch = useCallback(
    (search: string | null) => {
      // Reset to page 1 when search changes.
      navigate(buildParams({ search, page: '1' }));
    },
    [navigate, buildParams]
  );

  const reset = useCallback(() => {
    startTransition(() => {
      router.push(pathname);
    });
  }, [router, pathname]);

  return {
    query,
    setPage,
    setPageSize,
    setOrdering,
    setSearch,
    reset,
    isPending,
  };
}
