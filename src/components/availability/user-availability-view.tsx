'use client';

/**
 * UserAvailabilityView — view a colleague's free/busy windows over a date range.
 *
 * Privacy: only available/unavailable time windows from the API are rendered.
 * Private calendar event titles are NEVER shown — the underlying API types
 * (AvailableTimeWindow, UnavailableTimeWindow) do not include event titles.
 *
 * Colleague → Calendar resolution:
 * -----------------------------------------------------------------------
 * The colleague is chosen from a member-search picker (`useOrgMemberSearch`,
 * which yields a user id). That user id is mapped to the colleague's calendars
 * via `useColleagueCalendars` (GET /calendar/?owner=<user_id>, admin-scoped).
 * When the colleague has a single personal calendar it is selected
 * automatically; otherwise a calendar picker is shown.
 *
 * Note: Colleague free/busy reflects calendar events only; blocked times
 * aren't exposed for other users.
 * -----------------------------------------------------------------------
 *
 * UI:
 *  - Colleague picker (search by name/email) and, when needed, a calendar picker
 *  - Start date + End date inputs (date-only; the component adds T00:00:00 /
 *    T23:59:59 for the API datetime params)
 *  - Free/Busy table: green band = free, red band = busy; no private detail.
 *  - Loading skeleton, empty state, and error state.
 */

import * as React from 'react';
import { Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HStack, VStack, Stack, Text } from '@/components/layout';
import { useOrgMemberSearch } from '@/hooks/team/use-org-member-search';
import { useColleagueCalendars } from '@/hooks/availability/use-colleague-calendars';
import {
  useUserAvailability,
  type DateRange,
} from '@/hooks/availability/use-user-availability';
import { FreeBusyList } from './free-busy-list';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toStartDatetime(dateStr: string): string {
  return `${dateStr}T00:00:00`;
}

function toEndDatetime(dateStr: string): string {
  return `${dateStr}T23:59:59`;
}

// ---------------------------------------------------------------------------
// UserAvailabilityView
// ---------------------------------------------------------------------------

export function UserAvailabilityView() {
  const [selectedUserId, setSelectedUserId] = React.useState('');
  const [selectedCalendarId, setSelectedCalendarId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [submittedParams, setSubmittedParams] = React.useState<{
    calendarId: string;
    calendarLabel: string;
    range: DateRange;
  } | null>(null);

  // ---- Colleague search ----------------------------------------------------

  const [memberSearch, setMemberSearch] = React.useState('');
  const [debouncedMemberSearch, setDebouncedMemberSearch] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedMemberSearch(memberSearch), 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const { members, isLoading: membersLoading } = useOrgMemberSearch(
    debouncedMemberSearch
  );

  const selectedMember = members.find(
    (m) => String(m.id) === selectedUserId
  );

  // ---- Colleague → calendar resolution -------------------------------------

  const userIdNum = selectedUserId ? Number(selectedUserId) : null;
  const {
    calendars,
    isLoading: calendarsLoading,
    isError: calendarsError,
  } = useColleagueCalendars(userIdNum);

  // The effective calendar id is derived (no effect needed): honour a manual
  // pick when it still belongs to the resolved colleague, otherwise auto-select
  // the only calendar when there is exactly one. A stale pick (colleague just
  // changed) falls through to '' until the new list resolves.
  const resolvedCalendarId =
    selectedCalendarId &&
    calendars.some((c) => String(c.id) === selectedCalendarId)
      ? selectedCalendarId
      : calendars.length === 1
        ? String(calendars[0].id)
        : '';

  const showCalendarPicker = calendars.length > 1;

  // ---- Free/busy query -----------------------------------------------------

  const range = submittedParams?.range ?? null;
  const activeCalendarId = submittedParams?.calendarId ?? '';

  const { freeWindows, busyWindows, isLoading, isError } = useUserAvailability(
    activeCalendarId,
    range
  );

  const canCheck = Boolean(
    resolvedCalendarId && startDate && endDate && !isLoading
  );

  function handleCheck() {
    if (!resolvedCalendarId || !startDate || !endDate) return;
    const cal = calendars.find((c) => String(c.id) === resolvedCalendarId);
    const label = cal?.name ?? selectedMember?.name ?? resolvedCalendarId;
    setSubmittedParams({
      calendarId: resolvedCalendarId,
      calendarLabel: label,
      range: {
        startDatetime: toStartDatetime(startDate),
        endDatetime: toEndDatetime(endDate),
      },
    });
  }

  return (
    <Stack gap={6}>
      {/* Resolution notice */}
      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Search for a colleague to check their availability. Resolving a
          colleague&apos;s calendars requires organization admin access; if no
          calendars appear, ask your admin to check on your behalf.
        </AlertDescription>
      </Alert>

      {/* Input form */}
      <Stack gap={4}>
        <Stack gap={2}>
          <Label htmlFor='colleague-picker'>Colleague</Label>
          <Combobox
            id='colleague-picker'
            aria-label='Colleague'
            options={members.map((m) => ({
              value: String(m.id),
              label: m.name,
              description: m.email,
            }))}
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            onSearchChange={setMemberSearch}
            isLoading={membersLoading}
            placeholder='Select a colleague…'
            searchPlaceholder='Search by name or email…'
            emptyText={
              debouncedMemberSearch
                ? 'No members found.'
                : 'Type to search members.'
            }
            className='max-w-xs'
          />
        </Stack>

        {/* Calendar picker — only when the colleague has more than one. */}
        {showCalendarPicker && (
          <Stack gap={2}>
            <Label htmlFor='colleague-calendar-picker'>Calendar</Label>
            <Combobox
              id='colleague-calendar-picker'
              aria-label='Colleague calendar'
              options={calendars.map((c) => ({
                value: String(c.id),
                label: c.name,
              }))}
              value={resolvedCalendarId}
              onValueChange={setSelectedCalendarId}
              placeholder='Select a calendar…'
              searchPlaceholder='Search calendars…'
              className='max-w-xs'
            />
          </Stack>
        )}

        {/* Resolution feedback */}
        {selectedUserId && calendarsLoading && (
          <Text size='sm' color='muted-foreground'>
            Resolving calendars…
          </Text>
        )}
        {selectedUserId && !calendarsLoading && calendarsError && (
          <Text size='sm' className='text-destructive'>
            Could not resolve this colleague&apos;s calendars.
          </Text>
        )}
        {selectedUserId &&
          !calendarsLoading &&
          !calendarsError &&
          calendars.length === 0 && (
            <Text size='sm' color='muted-foreground'>
              No calendars found for this colleague.
            </Text>
          )}

        <HStack gap={4} className='flex-wrap'>
          <Stack gap={2}>
            <Label htmlFor='colleague-start-date'>Start date</Label>
            <Input
              id='colleague-start-date'
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className='w-44'
            />
          </Stack>
          <Stack gap={2}>
            <Label htmlFor='colleague-end-date'>End date</Label>
            <Input
              id='colleague-end-date'
              type='date'
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className='w-44'
            />
          </Stack>
        </HStack>

        <Button onClick={handleCheck} disabled={!canCheck} className='w-fit'>
          <Calendar className='mr-2 h-4 w-4' />
          {isLoading ? 'Loading…' : 'Check availability'}
        </Button>
      </Stack>

      {/* Results — only shown after submitting */}
      {submittedParams !== null && (
        <VStack gap={4}>
          <FreeBusyList
            freeWindows={freeWindows}
            busyWindows={busyWindows}
            isLoading={isLoading}
            isError={isError}
            calendarLabel={submittedParams.calendarLabel}
          />
        </VStack>
      )}
    </Stack>
  );
}
