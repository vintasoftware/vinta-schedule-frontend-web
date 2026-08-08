/**
 * canEditCalendar — the single predicate every editor phase (3b onward)
 * consumes for "can the current viewer write to this calendar's
 * group-scoped configuration". Kept pure and framework-free (no 'use
 * client', no React import) so it stays importable from a Server Component
 * too, and is directly unit-tested (group-permissions.test.ts) rather than
 * re-derived ad hoc inside component state — see the plan's Guiding
 * Decisions and Phase 2's "Permission widening is the main security risk"
 * note.
 *
 * The context/provider/hook that expose this predicate to the component
 * tree live in group-permissions-provider.tsx ('use client' — creates a
 * React context) so every roster row asks the same question the same way,
 * instead of each editor phase re-reading role + ownedCalendarIds and
 * recomputing the predicate itself.
 *
 * ---------------------------------------------------------------------
 * LOAD-BEARING ASSUMPTION (do not remove this paragraph without re-reading
 * it): `ownedCalendarIds` — supplied by the caller via
 * `@/hooks/calendars/use-owned-calendar-ids` — is trusted here to contain
 * *only* calendars the current member actually owns. That in turn depends
 * on the backend's `GET /calendar/?owner=me` returning only the caller's
 * own calendars. If that contract is ever wrong — the endpoint starts
 * returning calendars the caller does not own — `canEditCalendar` silently
 * grants a member write access to another person's roster row, and nothing
 * in this file (or its caller) can detect that from the frontend alone: the
 * frontend has no independent signal for calendar ownership to cross-check
 * against. This is recorded as Open Question 2 in
 * ai-plans/2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_IMPLEMENTATION_PLAN.md.
 * `use-owned-calendar-ids.ts` mitigates this as much as is cheaply possible
 * by passing `owner: 'me'` explicitly (documented to scope by caller
 * identity, not by role) rather than relying on the endpoint's role-based
 * default — but that is a mitigation, not a proof.
 * ---------------------------------------------------------------------
 */

import type { RoleEnum } from '@/client';

export interface CanEditCalendarParams {
  role: RoleEnum | null;
  ownedCalendarIds: ReadonlySet<number>;
  calendarId: number;
}

/**
 * Admins may edit any calendar's group-scoped configuration. Members may
 * edit only calendars they own. Any other role value (including `null` —
 * not yet resolved) edits nothing: this predicate fails closed.
 */
export function canEditCalendar({
  role,
  ownedCalendarIds,
  calendarId,
}: CanEditCalendarParams): boolean {
  if (role === 'admin') return true;
  if (role === 'member') return ownedCalendarIds.has(calendarId);
  return false;
}
