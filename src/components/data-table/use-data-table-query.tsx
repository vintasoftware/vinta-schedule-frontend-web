'use client';

// ---------------------------------------------------------------------------
// useDataTableQuery
//
// Syncs DataTableQuery state to/from URL search params so that sort,
// search, and page survive navigation and can be deep-linked.
//
// URL params (no prefix):
//   page        → "page"     (default: 1)
//   page_size   → "page_size" (default: pageSize arg, usually 20)
//   ordering    → "ordering" (default: null / omitted)
//   search      → "search"   (default: null / omitted)
//
// With prefix (e.g. prefix='inv'):
//   inv_page, inv_page_size, inv_ordering, inv_search
//
// Using a prefix allows multiple DataTables on the same page (e.g. tabs)
// to maintain independent URL state without contaminating each other.
// ---------------------------------------------------------------------------

import * as React from 'react';
import { useCallback, useTransition, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { DataTableQuery } from './types';
import { DEFAULT_DATA_TABLE_QUERY } from './types';

interface UseDataTableQueryOptions {
  /** Default page size. Defaults to 20. */
  defaultPageSize?: number;
  /**
   * Optional URL param prefix for namespacing when multiple tables share the
   * same URL (e.g. tabs on a page). With prefix='inv' the keys become
   * inv_page, inv_page_size, inv_ordering, inv_search.
   * Defaults to '' (no prefix, backward-compatible).
   */
  prefix?: string;
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

/**
 * Syncs DataTable query state (page, pageSize, ordering, search) to URL
 * search params via Next.js App Router.
 *
 * @remarks
 * **IMPORTANT — Suspense required.**
 * This hook calls `useSearchParams()` internally. In Next.js 15+, any
 * component that directly or indirectly calls `useSearchParams()` MUST be
 * rendered inside a `<Suspense>` boundary; otherwise Next.js will deopt the
 * entire route to client-side rendering and emit a build warning/error.
 *
 * Use the exported `DataTableQueryBoundary` wrapper to satisfy this
 * requirement without boilerplate at every call site:
 *
 * ```tsx
 * <DataTableQueryBoundary>
 *   <MyTablePage />   // calls useDataTableQuery inside
 * </DataTableQueryBoundary>
 * ```
 *
 * @throws If rendered outside a `<Suspense>` boundary in a Next.js 15+
 * app, the framework will either throw at build time or silently disable
 * static optimisation for the containing route segment.
 */
export function useDataTableQuery(
  options: UseDataTableQueryOptions = {}
): UseDataTableQueryReturn {
  const { defaultPageSize = DEFAULT_DATA_TABLE_QUERY.pageSize, prefix = '' } =
    options;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Build the URL param key, optionally prefixed (e.g. prefix='inv' → 'inv_page').
  const key = useCallback(
    (name: string) => (prefix ? `${prefix}_${name}` : name),
    [prefix]
  );

  // Read current query state from URL.
  const query: DataTableQuery = {
    page: parseIntOrDefault(searchParams.get(key('page')), 1),
    pageSize: parseIntOrDefault(
      searchParams.get(key('page_size')),
      defaultPageSize
    ),
    ordering: searchParams.get(key('ordering')),
    search: searchParams.get(key('search')) || null,
  };

  // Build a new URLSearchParams from the current ones + overrides.
  const buildParams = useCallback(
    (overrides: Partial<Record<string, string | null>>): string => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, value] of Object.entries(overrides)) {
        if (value === null || value === undefined || value === '') {
          params.delete(k);
        } else {
          params.set(k, value);
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
      navigate(buildParams({ [key('page')]: String(page) }));
    },
    [navigate, buildParams, key]
  );

  const setPageSize = useCallback(
    (size: number) => {
      // Reset to page 1 when page size changes.
      navigate(
        buildParams({ [key('page_size')]: String(size), [key('page')]: '1' })
      );
    },
    [navigate, buildParams, key]
  );

  const setOrdering = useCallback(
    (ordering: string | null) => {
      // Reset to page 1 when sort changes.
      navigate(
        buildParams({ [key('ordering')]: ordering, [key('page')]: '1' })
      );
    },
    [navigate, buildParams, key]
  );

  const setSearch = useCallback(
    (search: string | null) => {
      // Reset to page 1 when search changes.
      navigate(buildParams({ [key('search')]: search, [key('page')]: '1' }));
    },
    [navigate, buildParams, key]
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

// ---------------------------------------------------------------------------
// DataTableQueryBoundary
//
// Convenience wrapper that satisfies the Suspense requirement for any subtree
// that uses useDataTableQuery (and therefore useSearchParams). Wrap your
// DataTable feature component at the page level to avoid per-call boilerplate.
//
// Usage:
//   <DataTableQueryBoundary>
//     <TeamMembersTable />
//   </DataTableQueryBoundary>
// ---------------------------------------------------------------------------

export function DataTableQueryBoundary({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
