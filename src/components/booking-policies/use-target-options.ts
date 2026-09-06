/**
 * useTargetOptions — data sources for booking-policy targets.
 *
 * A booking policy can attach to a calendar, an appointment type, or a member, so
 * both the create dialog (picker options) and the table (id → label resolution)
 * need the org's calendars, appointment types, and members. This hook fetches all three
 * and exposes:
 *   - `calendarOptions` / `appointmentTypeOptions` / `memberOptions` for the Combobox.
 *   - `resolveTargetLabel(type, id)` for rendering an existing policy's target.
 *
 * Lists are fetched with a generous page size; an org with more than a few
 * hundred calendars/appointment types/members would need server-side search here, but the
 * picker is admin-only and the counts are small in practice.
 */

import * as React from 'react';
import type { ComboboxOption } from 'vinta-schedule-design-system/ui/combobox';
import { useAllCalendars } from '@/hooks/calendars/use-all-calendars';
import { useAppointmentTypes } from '@/hooks/appointment-types/use-appointment-types';
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
  const { appointmentTypes, isLoading: appointmentTypesLoading } =
    useAppointmentTypes({
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

  const appointmentTypeOptions = React.useMemo<ComboboxOption[]>(
    () => appointmentTypes.map((g) => ({ value: String(g.id), label: g.name })),
    [appointmentTypes]
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
          appointment_type: appointmentTypeOptions,
          membership: memberOptions,
        };
      const options = lookup[type];
      const match = options?.find((o) => o.value === String(id));
      if (match) return match.label;
      // Fall back to a stable id label when the entity isn't in the fetched
      // page (or was deleted) so the row still renders meaningfully.
      const fallbackPrefix: Partial<Record<BookingPolicyTargetType, string>> = {
        calendar: 'Calendar',
        appointment_type: 'AppointmentType',
        membership: 'Member',
      };
      return `${fallbackPrefix[type] ?? 'Target'} #${id}`;
    },
    [calendarOptions, appointmentTypeOptions, memberOptions]
  );

  return {
    calendarOptions,
    appointmentTypeOptions,
    memberOptions,
    resolveTargetLabel,
    isLoading: calendarsLoading || appointmentTypesLoading || membersLoading,
  };
}
