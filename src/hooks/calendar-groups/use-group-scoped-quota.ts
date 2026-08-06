/**
 * useGroupScopedQuota — list, create, partial update, and delete group-scoped
 * quota rules for one slot (optionally scoped to one calendar).
 *
 * REST surface: `.../calendar-groups/{group_id}/slots/{slot_id}/quota-rules/`
 * (see the handoff doc, `ai-plans/2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md`,
 * section 3). Mirrors use-group-scoped-windows.ts's shape (predicate-based
 * list invalidation, client-side calendarId filter over one generous page,
 * `row_gone` vs. transport-failure delete outcome) — see that module's doc
 * comment for the reasoning behind those choices, not repeated here.
 *
 * Quota rules are simpler than windows/blocks in one load-bearing way: a
 * quota rule caps *future* bookings and can never invalidate one already
 * confirmed, so there is no `orphaned_bookings` field anywhere in this
 * surface. Create returns the `GroupScopedQuotaRule` object directly (201),
 * not a write-result wrapper — `createQuotaRule`/`updateQuotaRule` return the
 * rule as-is, with nothing to unwrap.
 */

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calendarGroupsSlotsQuotaRulesCreateMutation,
  calendarGroupsSlotsQuotaRulesListOptions,
  calendarGroupsSlotsQuotaRulesPartialUpdateMutation,
} from '@/client/@tanstack/react-query.gen';
import { calendarGroupsSlotsQuotaRulesDestroy } from '@/client';
import type {
  GroupScopedQuotaRule,
  GroupScopedQuotaRuleCreate,
  PatchedGroupScopedQuotaRuleUpdate,
} from '@/client';

// The `_id` the generated factory tags every calendarGroupsSlotsQuotaRulesList*
// query key with (see `createQueryKey` in react-query.gen.ts). Exported so the
// predicate below — and any future caller invalidating this list from outside
// this file — matches on the same string rather than re-deriving it.
export const GROUP_SCOPED_QUOTA_LIST_OPERATION_ID =
  'calendarGroupsSlotsQuotaRulesList';

// Matches use-group-scoped-config-summary.ts's SUMMARY_PAGE_SIZE and the
// windows/blocks hooks' page size (same query shape: `{ limit: 200 }`, no
// `calendar_id` filter) so the underlying fetch dedupes across every caller
// reading this slot's quota-rule list.
export const GROUP_SCOPED_QUOTA_PAGE_SIZE = 200;

/**
 * Delete outcome. `row_gone` means the API answered 404 for this id — the
 * row does not exist from the server's point of view, whether because this
 * call raced another actor's delete or because it never resolved for this
 * caller (non-disclosure). It is NOT a transport failure: `deleteQuotaRule`
 * only rejects for those.
 */
export type DeleteQuotaRuleResult =
  | { status: 'deleted' }
  | { status: 'row_gone' };

export interface UseGroupScopedQuotaOptions {
  groupId: number;
  slotId: number;
  /** When set, only this calendar's rules are returned (client-side filter — see module doc comment). */
  calendarId?: number;
  /** Set to false to skip the fetch entirely. Defaults to true. */
  enabled?: boolean;
}

export interface CreateQuotaRuleInput {
  groupId: number;
  slotId: number;
  body: GroupScopedQuotaRuleCreate;
}

export interface UpdateQuotaRuleInput {
  groupId: number;
  slotId: number;
  ruleId: number;
  /** `period` and/or `cap` — only provided fields change. */
  body: PatchedGroupScopedQuotaRuleUpdate;
}

export interface DeleteQuotaRuleInput {
  groupId: number;
  slotId: number;
  ruleId: number;
}

export function useGroupScopedQuota({
  groupId,
  slotId,
  calendarId,
  enabled = true,
}: UseGroupScopedQuotaOptions) {
  const queryClient = useQueryClient();

  const quotaQuery = useQuery({
    ...calendarGroupsSlotsQuotaRulesListOptions({
      path: { group_id: groupId, slot_id: slotId },
      query: { limit: GROUP_SCOPED_QUOTA_PAGE_SIZE },
    }),
    enabled,
  });

  const allRules = React.useMemo(
    () => quotaQuery.data?.results ?? [],
    [quotaQuery.data]
  );
  const rules = React.useMemo(
    () =>
      calendarId === undefined
        ? allRules
        : allRules.filter((rule) => rule.calendar_id === calendarId),
    [allRules, calendarId]
  );

  const invalidateQuotaList = React.useCallback(() => {
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        (query.queryKey[0] as { _id?: string })?._id ===
          GROUP_SCOPED_QUOTA_LIST_OPERATION_ID,
    });
  }, [queryClient]);

  const createQuotaRuleMutation = useMutation({
    ...calendarGroupsSlotsQuotaRulesCreateMutation(),
    onSuccess: invalidateQuotaList,
  });
  const createQuotaRule = async (
    input: CreateQuotaRuleInput
  ): Promise<GroupScopedQuotaRule> =>
    createQuotaRuleMutation.mutateAsync({
      path: { group_id: input.groupId, slot_id: input.slotId },
      body: input.body,
    });

  const updateQuotaRuleMutation = useMutation({
    ...calendarGroupsSlotsQuotaRulesPartialUpdateMutation(),
    onSuccess: invalidateQuotaList,
  });
  const updateQuotaRule = async (
    input: UpdateQuotaRuleInput
  ): Promise<GroupScopedQuotaRule> =>
    updateQuotaRuleMutation.mutateAsync({
      path: {
        group_id: input.groupId,
        slot_id: input.slotId,
        id: String(input.ruleId),
      },
      body: input.body,
    });

  const deleteQuotaRuleMutation = useMutation({
    mutationFn: async (
      input: DeleteQuotaRuleInput
    ): Promise<DeleteQuotaRuleResult> => {
      const { response } = await calendarGroupsSlotsQuotaRulesDestroy({
        path: {
          group_id: input.groupId,
          slot_id: input.slotId,
          id: String(input.ruleId),
        },
        throwOnError: false,
      });
      if (!response) {
        throw new Error(
          'Failed to delete group-scoped quota rule (no response)'
        );
      }
      if (response.status === 404) {
        return { status: 'row_gone' };
      }
      if (!response.ok) {
        throw new Error(
          `Failed to delete group-scoped quota rule (${response.status})`
        );
      }
      return { status: 'deleted' };
    },
    // Both outcomes mean the row is confirmed absent server-side — refetch so
    // the panel converges rather than trusting local state (Guiding Decision:
    // "writes refetch; no optimistic updates").
    onSuccess: invalidateQuotaList,
  });
  const deleteQuotaRule = async (
    input: DeleteQuotaRuleInput
  ): Promise<DeleteQuotaRuleResult> =>
    deleteQuotaRuleMutation.mutateAsync(input);

  return {
    rules,
    /**
     * Total count of quota rules in the slot (across all calendars), as
     * returned by the API list endpoint. This is NOT affected by the
     * `calendarId` filter — it always reflects the whole slot's count. When
     * `calendarId` is set, `rules.length` will be less than or equal to
     * `totalCount`.
     */
    totalCount: quotaQuery.data?.count ?? 0,
    /**
     * True when the total count exceeds the page size fetched. When true,
     * the `rules` array is incomplete (a truncated page), and a "showing X
     * of Y" display would be a lower bound, not exact.
     */
    isTruncated: (quotaQuery.data?.count ?? 0) > GROUP_SCOPED_QUOTA_PAGE_SIZE,
    isLoading: quotaQuery.isLoading,
    isError: quotaQuery.isError,
    error: quotaQuery.error,
    quotaQuery,
    createQuotaRule,
    createQuotaRuleMutation,
    updateQuotaRule,
    updateQuotaRuleMutation,
    deleteQuotaRule,
    deleteQuotaRuleMutation,
  };
}
