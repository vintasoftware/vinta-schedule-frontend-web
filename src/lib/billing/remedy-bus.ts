/**
 * remedy-bus.ts — a minimal module-level publish/subscribe channel between
 * the shared `QueryClient`'s `MutationCache.onError` (query-client-provider.tsx)
 * and `RemedyRouter` (`@/components/billing/remedy-router.tsx`), Phase 8 of
 * the billing-hardening-gap-closure plan.
 *
 * WHY A BUS, NOT A DIRECT CALL: `MutationCache.onError` runs outside React —
 * it has no `useRouter()`, no component tree to open a dialog in. It can only
 * derive the remedy and announce it. `RemedyRouter` is mounted once, app-wide,
 * with a router and the ability to render a dialog, so it's the one place
 * that turns a remedy into an action (navigate, or open
 * `PurchaseAddOnDialog`). The bus is the seam between the two.
 *
 * Kept intentionally tiny (a `Set` of listeners) rather than pulling in a
 * state-management dependency — there is exactly one publisher and, in
 * practice, exactly one subscriber (`RemedyRouter`, mounted once in
 * `app-layout-client.tsx`), though `subscribeToRemedy` supports any number.
 */

import type { Remedy } from './derive-remedy';

export interface RemedyEvent {
  remedy: Remedy;
  /** The `resource` from the `limit_exceeded` body that triggered this remedy. */
  resource: string;
}

type RemedyListener = (event: RemedyEvent) => void;

const listeners = new Set<RemedyListener>();

/** Publishes a remedy event to every current subscriber. */
export function emitRemedy(event: RemedyEvent): void {
  listeners.forEach((listener) => listener(event));
}

/**
 * Subscribes to remedy events. Returns an unsubscribe function — call it
 * from a `useEffect` cleanup so a remount never double-delivers.
 */
export function subscribeToRemedy(listener: RemedyListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
