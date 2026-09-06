/**
 * useAppointmentTypeScopedBlocks — list, create, update, and delete appointment-type-scoped
 * blocked times for one slot (optionally scoped to one calendar).
 *
 * REST surface: `.../appointment-types/{appointment_type_id}/slots/{slot_id}/blocked-times/`
 * (see the handoff doc, `ai-plans/2026-08-05-CALENDAR_APPOINTMENT_TYPE_SCOPED_AVAILABILITY_HANDOFF.md`).
 * Mirrors use-appointment-type-scoped-windows.ts exactly, with `reason` added to the
 * body shape and the write result unwrapped to `{ block, orphanedBookings }`
 * instead of `{ window, orphanedBookings }`. See that module's doc comment
 * for the reasoning behind every choice below — it is not repeated here.
 *
 * One documented difference from windows: EVERY create and update runs
 * orphan detection here (not only the calendar's first window in the slot,
 * or a narrowing update) — see the handoff doc's "4.2 Appointment Type-scoped blocked
 * times" section. This hook does not encode that frequency difference
 * itself; it just always returns whatever `orphaned_bookings` the API sent
 * back, same as the windows hook does. The caller (appointment-type-block-form.tsx)
 * is where that difference actually matters, because it means the orphan
 * alert fires far more often here than for windows.
 */

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appointmentTypesSlotsBlockedTimesCreateMutation,
  appointmentTypesSlotsBlockedTimesListOptions,
  appointmentTypesSlotsBlockedTimesPartialUpdateMutation,
} from '@/client/@tanstack/react-query.gen';
import { appointmentTypesSlotsBlockedTimesDestroy } from '@/client';
import type {
  AppointmentTypeScopedBlockedTime,
  AppointmentTypeScopedBlockedTimeCreate,
  AppointmentTypeScopedBlockOrphanedBooking,
  PatchedAppointmentTypeScopedBlockedTimeUpdate,
} from '@/client';

// The `_id` the generated factory tags every appointmentTypesSlotsBlockedTimesList*
// query key with (see `createQueryKey` in react-query.gen.ts). Exported so the
// predicate below — and any future caller invalidating this list from outside
// this file — matches on the same string rather than re-deriving it.
export const APPOINTMENT_TYPE_SCOPED_BLOCKS_LIST_OPERATION_ID =
  'appointmentTypesSlotsBlockedTimesList';

// Matches use-appointment-type-scoped-config-summary.ts's SUMMARY_PAGE_SIZE and
// use-appointment-type-scoped-windows.ts's APPOINTMENT_TYPE_SCOPED_WINDOWS_PAGE_SIZE (same query
// shape: `{ limit: 200 }`, no `calendar_id` filter) so the underlying fetch
// dedupes across every caller reading this slot's blocked-time list.
export const APPOINTMENT_TYPE_SCOPED_BLOCKS_PAGE_SIZE = 200;

export interface AppointmentTypeScopedBlockWriteResultUnwrapped {
  block: AppointmentTypeScopedBlockedTime;
  orphanedBookings: AppointmentTypeScopedBlockOrphanedBooking[];
}

/**
 * Delete outcome. `row_gone` means the API answered 404 for this id — the
 * row does not exist from the server's point of view, whether because this
 * call raced another actor's delete or because it never resolved for this
 * caller (non-disclosure). It is NOT a transport failure: `deleteBlock`
 * only rejects for those.
 */
export type DeleteBlockResult = { status: 'deleted' } | { status: 'row_gone' };

export interface UseAppointmentTypeScopedBlocksOptions {
  appointmentTypeId: number;
  slotId: number;
  /** When set, only this calendar's blocks are returned (client-side filter — see module doc comment). */
  calendarId?: number;
  /** Set to false to skip the fetch entirely. Defaults to true. */
  enabled?: boolean;
}

export interface CreateBlockInput {
  appointmentTypeId: number;
  slotId: number;
  body: AppointmentTypeScopedBlockedTimeCreate;
}

export interface UpdateBlockInput {
  appointmentTypeId: number;
  slotId: number;
  blockId: number;
  /**
   * `rrule_string` on this body is TRI-STATE, matching the API's PATCH
   * contract exactly — same convention as UpdateWindowInput's body:
   *  - omit the key (don't set it at all) → recurrence is left unchanged.
   *  - `rrule_string: null` → clears it (the block becomes non-recurring).
   *  - `rrule_string: '<RRULE string>'` → sets/replaces it.
   * `reason` is INDEPENDENTLY optional on this same body: omitting it
   * leaves the block's reason unchanged too — the generated client's
   * `JSON.stringify` drops `undefined` keys, so omitting a key and setting
   * it to `undefined` both leave the field untouched on the wire.
   */
  body: PatchedAppointmentTypeScopedBlockedTimeUpdate;
}

export interface DeleteBlockInput {
  appointmentTypeId: number;
  slotId: number;
  blockId: number;
}

export function useAppointmentTypeScopedBlocks({
  appointmentTypeId,
  slotId,
  calendarId,
  enabled = true,
}: UseAppointmentTypeScopedBlocksOptions) {
  const queryClient = useQueryClient();

  const blocksQuery = useQuery({
    ...appointmentTypesSlotsBlockedTimesListOptions({
      path: { appointment_type_id: appointmentTypeId, slot_id: slotId },
      query: { limit: APPOINTMENT_TYPE_SCOPED_BLOCKS_PAGE_SIZE },
    }),
    enabled,
  });

  const allBlocks = React.useMemo(
    () => blocksQuery.data?.results ?? [],
    [blocksQuery.data]
  );
  const blocks = React.useMemo(
    () =>
      calendarId === undefined
        ? allBlocks
        : allBlocks.filter((block) => block.calendar_id === calendarId),
    [allBlocks, calendarId]
  );

  const invalidateBlocksList = React.useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey[0] as { _id?: string })?._id ===
          APPOINTMENT_TYPE_SCOPED_BLOCKS_LIST_OPERATION_ID,
    });
  }, [queryClient]);

  const createBlockMutation = useMutation({
    ...appointmentTypesSlotsBlockedTimesCreateMutation(),
    onSuccess: invalidateBlocksList,
    // appointment-type-block-form.tsx renders an inline, batch-aware OverLimitAlert for
    // this write's 402 rejection (see over-limit-alert.tsx) — opt out of the
    // global MutationCache.onError remedy routing (query-client-provider.tsx,
    // Phase 8) so the same rejection is never both shown inline AND routed
    // away with a disruptive navigation.
    meta: { overLimitHandledInline: true },
  });
  const createBlock = async (
    input: CreateBlockInput
  ): Promise<AppointmentTypeScopedBlockWriteResultUnwrapped> => {
    const result = await createBlockMutation.mutateAsync({
      path: {
        appointment_type_id: input.appointmentTypeId,
        slot_id: input.slotId,
      },
      body: input.body,
    });
    return {
      block: result.block,
      orphanedBookings: result.orphaned_bookings,
    };
  };

  const updateBlockMutation = useMutation({
    ...appointmentTypesSlotsBlockedTimesPartialUpdateMutation(),
    onSuccess: invalidateBlocksList,
    // See createBlockMutation's comment above.
    meta: { overLimitHandledInline: true },
  });
  const updateBlock = async (
    input: UpdateBlockInput
  ): Promise<AppointmentTypeScopedBlockWriteResultUnwrapped> => {
    const result = await updateBlockMutation.mutateAsync({
      path: {
        appointment_type_id: input.appointmentTypeId,
        slot_id: input.slotId,
        id: String(input.blockId),
      },
      body: input.body,
    });
    return {
      block: result.block,
      orphanedBookings: result.orphaned_bookings,
    };
  };

  const deleteBlockMutation = useMutation({
    mutationFn: async (input: DeleteBlockInput): Promise<DeleteBlockResult> => {
      const { response } = await appointmentTypesSlotsBlockedTimesDestroy({
        path: {
          appointment_type_id: input.appointmentTypeId,
          slot_id: input.slotId,
          id: String(input.blockId),
        },
        throwOnError: false,
      });
      if (!response) {
        throw new Error(
          'Failed to delete appointment-type-scoped block (no response)'
        );
      }
      if (response.status === 404) {
        return { status: 'row_gone' };
      }
      if (!response.ok) {
        throw new Error(
          `Failed to delete appointment-type-scoped block (${response.status})`
        );
      }
      return { status: 'deleted' };
    },
    // Both outcomes mean the row is confirmed absent server-side — refetch so
    // the panel converges rather than trusting local state (Guiding Decision:
    // "writes refetch; no optimistic updates").
    onSuccess: invalidateBlocksList,
  });
  const deleteBlock = async (
    input: DeleteBlockInput
  ): Promise<DeleteBlockResult> => deleteBlockMutation.mutateAsync(input);

  return {
    blocks,
    /**
     * Total count of blocks in the slot (across all calendars), as returned
     * by the API list endpoint. This is NOT affected by the `calendarId`
     * filter — it always reflects the whole slot's count. When `calendarId` is
     * set, `blocks.length` will be less than or equal to `totalCount`.
     */
    totalCount: blocksQuery.data?.count ?? 0,
    /**
     * True when the total count exceeds the page size fetched. When true, the
     * `blocks` array is incomplete (a truncated page), and the count returned
     * by a "showing X of Y" display would be a lower bound, not exact.
     */
    isTruncated:
      (blocksQuery.data?.count ?? 0) > APPOINTMENT_TYPE_SCOPED_BLOCKS_PAGE_SIZE,
    isLoading: blocksQuery.isLoading,
    isError: blocksQuery.isError,
    error: blocksQuery.error,
    blocksQuery,
    createBlock,
    createBlockMutation,
    updateBlock,
    updateBlockMutation,
    deleteBlock,
    deleteBlockMutation,
  };
}
