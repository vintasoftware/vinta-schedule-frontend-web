import type { ReactNode } from 'react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';

/**
 * BillingLayout — the billing area shell for the `(app)/billing` route group.
 *
 * A thin Server Component that composes the billing routes under the app
 * layout with consistent vertical rhythm. It stays server-side (no 'use
 * client') so Next.js can stream it without blocking on client JS; the
 * data-fetching islands live in the individual pages (real content lands in
 * Phase 2+). Deliberately unlinked in Phase 0 — the sidebar entry is wired in
 * Phase 9.
 */
export default function BillingLayout({ children }: { children: ReactNode }) {
  return <Stack gap={6}>{children}</Stack>;
}
