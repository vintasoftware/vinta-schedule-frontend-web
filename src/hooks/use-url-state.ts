'use client';

// ---------------------------------------------------------------------------
// useUrlState — read/write a single URL search param.
//
// Returns [value, setValue]. `value` is the current param string, or
// `defaultValue` when the param is absent. `setValue(null)` — or setting the
// value back to `defaultValue` — removes the param so URLs stay clean for the
// default state.
//
// Uses router.replace so param changes (tab switches, pagination) don't pile up
// in browser history. The param survives refresh and is deep-linkable.
//
// IMPORTANT — Suspense boundary:
//   This hook calls useSearchParams(). In Next.js 15+, any component that
//   directly or indirectly calls useSearchParams() MUST render inside a
//   <Suspense> boundary, otherwise the route deopts to client rendering.
// ---------------------------------------------------------------------------

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function useUrlState(
  key: string,
  defaultValue: string
): readonly [string, (next: string | null) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(key) ?? defaultValue;

  const setValue = React.useCallback(
    (next: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null || next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      router.replace(`${pathname}${qs}`);
    },
    [key, defaultValue, router, pathname, searchParams]
  );

  return [value, setValue] as const;
}
