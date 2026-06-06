'use client';

/**
 * UserAvailabilityView — view a colleague's free/busy windows over a date range.
 *
 * Privacy: only available/unavailable time windows from the API are rendered.
 * Private calendar event titles are NEVER shown — the underlying API types
 * (AvailableTimeWindow, UnavailableTimeWindow) do not include event titles.
 *
 * Colleague → Calendar resolution gap (documented):
 * -----------------------------------------------------------------------
 * OrganizationMembership does not expose a calendar_id for each member, and
 * GET /calendar/ is caller-scoped. There is no API endpoint to derive a
 * colleague's calendar id from their org membership record.
 *
 * This component therefore asks the user to enter the target calendar ID
 * manually (a numeric id visible in admin or shared by the colleague). When
 * the backend exposes a member → calendar mapping, this input can be replaced
 * by an auto-resolved colleague picker without changing the hook interface.
 *
 * Note: Colleague free/busy reflects calendar events only; blocked times
 * aren't exposed for other users.
 * -----------------------------------------------------------------------
 *
 * UI:
 *  - Calendar ID text input (with explanatory note about the gap)
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HStack, VStack, Stack } from '@/components/layout';
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
  const [calendarId, setCalendarId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [submittedParams, setSubmittedParams] = React.useState<{
    calendarId: string;
    range: DateRange;
  } | null>(null);

  const range = submittedParams?.range ?? null;
  const activeCalendarId = submittedParams?.calendarId ?? '';

  const { freeWindows, busyWindows, isLoading, isError } = useUserAvailability(
    activeCalendarId,
    range
  );

  function handleCheck() {
    if (!calendarId.trim() || !startDate || !endDate) return;
    setSubmittedParams({
      calendarId: calendarId.trim(),
      range: {
        startDatetime: toStartDatetime(startDate),
        endDatetime: toEndDatetime(endDate),
      },
    });
  }

  return (
    <Stack gap={6}>
      {/* Resolution gap notice */}
      <Alert>
        <Info className='h-4 w-4' />
        <AlertDescription>
          Enter the calendar ID of the colleague whose availability you want to
          check. Calendar IDs are not yet exposed through the member directory —
          ask your colleague or your admin to share their calendar ID.
        </AlertDescription>
      </Alert>

      {/* Input form */}
      <Stack gap={4}>
        <Stack gap={2}>
          <Label htmlFor='colleague-calendar-id'>
            Colleague&apos;s calendar ID
          </Label>
          <Input
            id='colleague-calendar-id'
            type='number'
            min='1'
            placeholder='e.g. 42'
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
            className='max-w-xs'
          />
        </Stack>

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

        <Button
          onClick={handleCheck}
          disabled={!calendarId.trim() || !startDate || !endDate || isLoading}
          className='w-fit'
        >
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
            calendarLabel={submittedParams.calendarId}
          />
        </VStack>
      )}
    </Stack>
  );
}
