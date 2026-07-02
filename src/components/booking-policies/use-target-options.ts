/**
 * useTargetOptions — data sources for booking-policy targets.
 *
 * A booking policy can attach to a calendar, a calendar group, or a member, so
 * both the create dialog (picker options) and the table (id → label resolution)
 * need the org's calendars, groups, and members. This hook fetches all three
 * and exposes:
 *   - `calendarOptions` / `groupOptions` / `memberOptions` for the Combobox.
 *   - `resolveTargetLabel(type, id)` for rendering an existing policy's target.
 *
 * Lists are fetched with a generous page size; an org with more than a few
 * hundred calendars/groups/members would need server-side search here, but the
 * picker is admin-only and the counts are small in practice.
 */

import * as React from 'react';
import type { ComboboxOption } from '@/components/ui/combobox';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useCalendarGroups } from '@/hooks/calendar-groups/use-calendar-groups';
import { useTeamMembers } from '@/hooks/team/use-team-members';
import type { DataTableQuery } from '@/components/data-table/types';
import { CALENDAR_TYPE_LABELS } from './calendar-type-labels';
import type { BookingPolicyTargetType } from './target';

const FETCH_ALL_QUERY: DataTableQuery = {
  page: 1,
  pageSize: 100,
  ordering: null,
  search: null,
};

export function useTargetOptions() {
  const { calendars, isLoading: calendarsLoading } =
    useAllCalendars(FETCH_ALL_QUERY);
  const { groups, isLoading: groupsLoading } = useCalendarGroups({
    query: FETCH_ALL_QUERY,
  });
  const { members, isLoading: membersLoading } =
    useTeamMembers(FETCH_ALL_QUERY);

  const calendarOptions = React.useMemo<ComboboxOption[]>(
    () =>
      calendars.map((c) => ({
        value: String(c.id),
        label: c.name,
        description: CALENDAR_TYPE_LABELS[c.calendar_type] ?? c.calendar_type,
      })),
    [calendars]
  );

  const groupOptions = React.useMemo<ComboboxOption[]>(
    () => groups.map((g) => ({ value: String(g.id), label: g.name })),
    [groups]
  );

  const memberOptions = React.useMemo<ComboboxOption[]>(
    () =>
      members.map((m) => ({
        value: String(m.id),
        label: m.name,
        description: m.email,
      })),
    [members]
  );

  const resolveTargetLabel = React.useCallback(
    (type: BookingPolicyTargetType, id: number | null): string => {
      if (id == null) return '—';
      const lookup: Partial<Record<BookingPolicyTargetType, ComboboxOption[]>> =
        {
          calendar: calendarOptions,
          calendar_group: groupOptions,
          membership: memberOptions,
        };
      const options = lookup[type];
      const match = options?.find((o) => o.value === String(id));
      if (match) return match.label;
      // Fall back to a stable id label when the entity isn't in the fetched
      // page (or was deleted) so the row still renders meaningfully.
      const fallbackPrefix: Partial<Record<BookingPolicyTargetType, string>> = {
        calendar: 'Calendar',
        calendar_group: 'Group',
        membership: 'Member',
      };
      return `${fallbackPrefix[type] ?? 'Target'} #${id}`;
    },
    [calendarOptions, groupOptions, memberOptions]
  );

  return {
    calendarOptions,
    groupOptions,
    memberOptions,
    resolveTargetLabel,
    isLoading: calendarsLoading || groupsLoading || membersLoading,
  };
}
