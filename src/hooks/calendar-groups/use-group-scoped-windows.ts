/**
 * useGroupScopedWindows — list, create, update, and delete group-scoped
 * availability windows for one slot (optionally scoped to one calendar).
 *
 * REST surface: `.../calendar-groups/{group_id}/slots/{slot_id}/availability-windows/`
 * (see the handoff doc, `ai-plans/2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md`).
 *
 * List has no `calendar_id` query param (confirmed against schema.yml — the
 * endpoint only accepts `limit`/`offset`), so filtering to one calendar is
 * done client-side over a single generous page, the same tradeoff
 * use-group-scoped-config-summary.ts makes for its per-calendar counts: a
 * slot roster is small in practice, and a slot with more group-scoped
 * windows than the page size undercounts rather than fails. There is no
 * pagination UI planned for the weekday grid this hook feeds (Phase 3b) —
 * it needs "all of this calendar's windows in this slot", not a page of
 * rows.
 *
 * Every successful write invalidates the slot's window list by PREDICATE,
 * not by re-deriving the no-args key — see the CAVEAT in use-all-
 * calendars.ts:15-28. The generated `calendarGroupsSlotsAvailabilityWindowsListQueryKey`
 * factory encodes `path`/`query` inside the key array, so a bare
 * `calendarGroupsSlotsAvailabilityWindowsListQueryKey()` (no options) is not
 * guaranteed to be a prefix of the per-page keys this hook actually queries
 * with.
 *
 * Create and update return the write result unwrapped into
 * `{ window, orphanedBookings }` so callers never reach into the generated
 * `GroupScopedAvailabilityWriteResult` shape (`{ window, orphaned_bookings }`).
 *
 * Delete distinguishes "the row is already gone" (API answers 404 — someone
 * else deleted it first, or it never resolved for this caller; the API
 * doesn't distinguish, see the non-disclosure note in the handoff doc) from
 * a genuine transport failure. It calls the generated operation with
 * `throwOnError:false` rather than the generated `*DestroyMutation` factory,
 * because the factory's `throwOnError:true` path throws only the parsed
 * response body (see isNotFoundError in `@/lib/utils/api-errors.ts`) — no
 * status code — and telling "row already gone" from "the server errored"
 * needs the status.
 */

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calendarGroupsSlotsAvailabilityWindowsCreateMutation,
  calendarGroupsSlotsAvailabilityWindowsListOptions,
  calendarGroupsSlotsAvailabilityWindowsPartialUpdateMutation,
} from '@/client/@tanstack/react-query.gen';
import { calendarGroupsSlotsAvailabilityWindowsDestroy } from '@/client';
import type {
  GroupScopedAvailabilityOrphanedBooking,
  GroupScopedAvailabilityWindow,
  GroupScopedAvailabilityWindowCreate,
  PatchedGroupScopedAvailabilityWindowUpdate,
} from '@/client';

// The `_id` the generated factory tags every calendarGroupsSlotsAvailabilityWindowsList*
// query key with (see `createQueryKey` in react-query.gen.ts). Exported so the
// predicate below — and any future caller invalidating this list from outside
// this file — matches on the same string rather than re-deriving it.
export const GROUP_SCOPED_WINDOWS_LIST_OPERATION_ID =
  'calendarGroupsSlotsAvailabilityWindowsList';

export const GROUP_SCOPED_WINDOWS_PAGE_SIZE = 200;

export interface GroupScopedWindowWriteResult {
  window: GroupScopedAvailabilityWindow;
  orphanedBookings: GroupScopedAvailabilityOrphanedBooking[];
}

/**
 * Delete outcome. `row_gone` means the API answered 404 for this id — the
 * row does not exist from the server's point of view, whether because this
 * call raced another actor's delete or because it never resolved for this
 * caller (non-disclosure). It is NOT a transport failure: `deleteWindow`
 * only rejects for those.
 */
export type DeleteWindowResult = { status: 'deleted' } | { status: 'row_gone' };

export interface UseGroupScopedWindowsOptions {
  groupId: number;
  slotId: number;
  /** When set, only this calendar's windows are returned (client-side filter — see module doc comment). */
  calendarId?: number;
  /** Set to false to skip the fetch entirely. Defaults to true. */
  enabled?: boolean;
}

export interface CreateWindowInput {
  groupId: number;
  slotId: number;
  body: GroupScopedAvailabilityWindowCreate;
}

export interface UpdateWindowInput {
  groupId: number;
  slotId: number;
  windowId: number;
  /**
   * `rrule_string` on this body is TRI-STATE, matching the API's PATCH
   * contract exactly:
   *  - omit the key (don't set it at all) → recurrence is left unchanged.
   *  - `rrule_string: null` → clears it (the window becomes non-recurring).
   *  - `rrule_string: '<RRULE string>'` → sets/replaces it.
   * The generated client JSON-serializes the body with `JSON.stringify`,
   * which drops object keys whose value is `undefined` — so passing
   * `rrule_string: undefined` and omitting the key entirely produce the same
   * wire request (both leave the field untouched). Only an explicit `null`
   * or an explicit string reaches the server as `rrule_string`.
   */
  body: PatchedGroupScopedAvailabilityWindowUpdate;
}

export interface DeleteWindowInput {
  groupId: number;
  slotId: number;
  windowId: number;
}

export function useGroupScopedWindows({
  groupId,
  slotId,
  calendarId,
  enabled = true,
}: UseGroupScopedWindowsOptions) {
  const queryClient = useQueryClient();

  const windowsQuery = useQuery({
    ...calendarGroupsSlotsAvailabilityWindowsListOptions({
      path: { group_id: groupId, slot_id: slotId },
      query: { limit: GROUP_SCOPED_WINDOWS_PAGE_SIZE },
    }),
    enabled,
  });

  const allWindows = React.useMemo(
    () => windowsQuery.data?.results ?? [],
    [windowsQuery.data]
  );
  const windows = React.useMemo(
    () =>
      calendarId === undefined
        ? allWindows
        : allWindows.filter((window) => window.calendar_id === calendarId),
    [allWindows, calendarId]
  );

  const invalidateWindowsList = React.useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey[0] as { _id?: string })?._id ===
          GROUP_SCOPED_WINDOWS_LIST_OPERATION_ID,
    });
  }, [queryClient]);

  const createWindowMutation = useMutation({
    ...calendarGroupsSlotsAvailabilityWindowsCreateMutation(),
    onSuccess: invalidateWindowsList,
  });
  const createWindow = async (
    input: CreateWindowInput
  ): Promise<GroupScopedWindowWriteResult> => {
    const result = await createWindowMutation.mutateAsync({
      path: { group_id: input.groupId, slot_id: input.slotId },
      body: input.body,
    });
    return {
      window: result.window,
      orphanedBookings: result.orphaned_bookings,
    };
  };

  const updateWindowMutation = useMutation({
    ...calendarGroupsSlotsAvailabilityWindowsPartialUpdateMutation(),
    onSuccess: invalidateWindowsList,
  });
  const updateWindow = async (
    input: UpdateWindowInput
  ): Promise<GroupScopedWindowWriteResult> => {
    const result = await updateWindowMutation.mutateAsync({
      path: {
        group_id: input.groupId,
        slot_id: input.slotId,
        id: String(input.windowId),
      },
      body: input.body,
    });
    return {
      window: result.window,
      orphanedBookings: result.orphaned_bookings,
    };
  };

  const deleteWindowMutation = useMutation({
    mutationFn: async (
      input: DeleteWindowInput
    ): Promise<DeleteWindowResult> => {
      const { response } = await calendarGroupsSlotsAvailabilityWindowsDestroy({
        path: {
          group_id: input.groupId,
          slot_id: input.slotId,
          id: String(input.windowId),
        },
        throwOnError: false,
      });
      if (!response) {
        throw new Error('Failed to delete group-scoped window (no response)');
      }
      if (response.status === 404) {
        return { status: 'row_gone' };
      }
      if (!response.ok) {
        throw new Error(
          `Failed to delete group-scoped window (${response.status})`
        );
      }
      return { status: 'deleted' };
    },
    // Both outcomes mean the row is confirmed absent server-side — refetch so
    // the panel converges rather than trusting local state (Guiding Decision:
    // "writes refetch; no optimistic updates").
    onSuccess: invalidateWindowsList,
  });
  const deleteWindow = async (
    input: DeleteWindowInput
  ): Promise<DeleteWindowResult> => deleteWindowMutation.mutateAsync(input);

  return {
    windows,
    totalCount: windowsQuery.data?.count ?? 0,
    isLoading: windowsQuery.isLoading,
    isError: windowsQuery.isError,
    error: windowsQuery.error,
    windowsQuery,
    createWindow,
    createWindowMutation,
    updateWindow,
    updateWindowMutation,
    deleteWindow,
    deleteWindowMutation,
  };
}
