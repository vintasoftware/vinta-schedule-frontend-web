'use client';

import React from 'react';
import {
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query';
import { recoverFromOrganizationQueryError } from '@/hooks/organizations/use-organization-error-recovery';

// ---------------------------------------------------------------------------
// QueryClient factory with organization error recovery
//
// The QueryCache onError is wired to `recoverFromOrganizationQueryError` so
// that any tenant query returning 400 {"detail":"X-Organization-Id header
// required."} automatically picks the first org from mine/ and invalidates
// all queries to retry with the header.
//
// Pattern for reaching the client inside onError:
//   We use a mutable ref object ({ current: QueryClient | null }) so the
//   onError closure can capture the ref and read `.current` after construction.
//   This avoids the `prefer-const` lint error from `let client = ...` while
//   still allowing the cache and client to be created in the right order.
// ---------------------------------------------------------------------------

function makeQueryClient(): QueryClient {
  // A mutable ref so the onError closure can reach the same client instance.
  const clientRef: { current: QueryClient | null } = { current: null };

  const cache = new QueryCache({
    onError: (error) => {
      if (!clientRef.current) return;
      // Fire-and-forget; swallow any rejection so it never becomes an
      // unhandled promise rejection. Recovery is a best-effort safety net.
      void recoverFromOrganizationQueryError(error, clientRef.current).catch(
        () => {}
      );
    },
  });

  const client = new QueryClient({
    queryCache: cache,
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
      mutations: {
        retry: 1,
      },
    },
  });

  clientRef.current = client;
  return client;
}

// Browser-scoped singleton — SSR always gets a fresh client.
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
  }
}

export function QueryClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getQueryClient();

  return (
    <TanStackQueryClientProvider client={client}>
      {children}
    </TanStackQueryClientProvider>
  );
}
