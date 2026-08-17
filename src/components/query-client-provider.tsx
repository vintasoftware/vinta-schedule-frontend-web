'use client';

import React from 'react';
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider as TanStackQueryClientProvider,
} from '@tanstack/react-query';
import { recoverFromOrganizationQueryError } from '@/hooks/organizations/use-organization-error-recovery';
import { billingSubscriptionRetrieveSubscriptionRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { Subscription } from '@/client';
import { readOverLimitError } from '@/lib/utils/api-errors';
import { deriveRemedy } from '@/lib/billing/derive-remedy';
import { emitRemedy } from '@/lib/billing/remedy-bus';
import { ADD_ON_PURCHASABLE_RESOURCE_KEYS } from '@/lib/billing/resource-labels';

// ---------------------------------------------------------------------------
// QueryClient factory with organization error recovery + the global
// over-limit → remedy handler
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

function isAddOnPurchasable(resource: string): boolean {
  return (ADD_ON_PURCHASABLE_RESOURCE_KEYS as string[]).includes(resource);
}

export function makeQueryClient(): QueryClient {
  // A mutable ref so the onError closures can reach the same client instance.
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

  // ---------------------------------------------------------------------
  // Global over-limit handler (Phase 8, billing-hardening-gap-closure plan)
  //
  // ONE MutationCache.onError, wired once here, covers every guarded write
  // in the app (invitations, calendars, groups, webhooks, bookings, system
  // users, …) without touching each call site. It is a NO-OP for every
  // error that is not the 402 `limit_exceeded` shape — that check is the
  // very first thing this handler does, and it returns immediately when it
  // fails, leaving today's behavior (mutation-level onError still runs;
  // nothing else here reacts) completely unchanged. A pass-through
  // regression test in query-client-provider.test.tsx proves this for a
  // generic mutation error AND for a differently-coded billing error (e.g.
  // `charge_declined`), both of which must NOT route anywhere.
  //
  // The calendar-groups group-scoped writes (windows/blocks/quota rules)
  // already render an inline, batch-aware `OverLimitAlert` in place — see
  // over-limit-alert.tsx. Those mutations set `meta.overLimitHandledInline`
  // so this handler skips them; otherwise the same rejection would BOTH show
  // the inline alert AND fire a disruptive navigation.
  //
  // Best-effort: wrapped in try/catch, same convention as the QueryCache
  // recovery above — a bug in remedy derivation must never break the
  // mutation's own error pipeline (its `onError`/`onSettled` still run
  // regardless of what happens here).
  // ---------------------------------------------------------------------
  const mutationCache = new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      try {
        const overLimit = readOverLimitError(error);
        if (overLimit === null) {
          return;
        }
        if (mutation.meta?.overLimitHandledInline === true) {
          return;
        }
        if (!clientRef.current) return;

        const subscription = clientRef.current.getQueryData<Subscription>(
          billingSubscriptionRetrieveSubscriptionRetrieveOptions().queryKey
        );

        const remedy = deriveRemedy(
          overLimit.resource,
          subscription?.billing_state ?? null,
          isAddOnPurchasable
        );

        // No router/component tree reaches from here — emit, don't
        // navigate. `RemedyRouter` (mounted app-wide) subscribes and acts.
        emitRemedy({ remedy, resource: overLimit.resource });
      } catch {
        // Best-effort — never let a routing bug break the mutation pipeline.
      }
    },
  });

  const client = new QueryClient({
    queryCache: cache,
    mutationCache,
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
