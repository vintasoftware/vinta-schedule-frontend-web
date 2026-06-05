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
import { Calendar, Clock, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HStack, VStack, Stack, Text, Heading } from '@/components/layout';
import {
  useUserAvailability,
  type DateRange,
} from '@/hooks/availability/use-user-availability';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toStartDatetime(dateStr: string): string {
  return `${dateStr}T00:00:00`;
}

function toEndDatetime(dateStr: string): string {
  return `${dateStr}T23:59:59`;
}

function formatTime(isoDatetime: string): string {
  try {
    const d = new Date(isoDatetime);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoDatetime;
  }
}

function formatDate(isoDatetime: string): string {
  try {
    const d = new Date(isoDatetime);
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDatetime.slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <VStack gap={2}>
      {[1, 2, 3].map((n) => (
        <Skeleton key={n} className='h-12 w-full rounded-md' />
      ))}
    </VStack>
  );
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

  const { freeWindows, busyWindows, isLoading, isError, error } =
    useUserAvailability(activeCalendarId, range);

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

  const hasResults = !isLoading && !isError && submittedParams !== null;
  const totalWindows = freeWindows.length + busyWindows.length;

  // Merge and sort windows chronologically for display
  type WindowEntry =
    | { kind: 'free'; start_time: string; end_time: string }
    | {
        kind: 'busy';
        start_time: string;
        end_time: string;
        reason_description: string;
      };

  const mergedWindows: WindowEntry[] = [
    ...freeWindows.map((w) => ({
      kind: 'free' as const,
      start_time: w.start_time,
      end_time: w.end_time,
    })),
    ...busyWindows.map((w) => ({
      kind: 'busy' as const,
      start_time: w.start_time,
      end_time: w.end_time,
      reason_description: w.reason_description,
    })),
  ].sort((a, b) => a.start_time.localeCompare(b.start_time));

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

      {/* Results */}
      {isLoading && <LoadingSkeleton />}

      {isError && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>
            {error?.message ??
              'Failed to load availability. Check the calendar ID and try again.'}
          </AlertDescription>
        </Alert>
      )}

      {hasResults && totalWindows === 0 && (
        <Text color='muted-foreground' className='py-4 text-center'>
          No availability windows found for this range.
        </Text>
      )}

      {hasResults && totalWindows > 0 && (
        <Stack gap={3}>
          <Heading size='sm'>
            Free/busy for calendar {submittedParams!.calendarId}
          </Heading>
          <HStack gap={4} className='text-sm'>
            <HStack gap={1}>
              <span className='inline-block h-3 w-3 rounded-sm bg-green-500' />
              <Text>Free ({freeWindows.length})</Text>
            </HStack>
            <HStack gap={1}>
              <span className='inline-block h-3 w-3 rounded-sm bg-red-500' />
              <Text>Busy ({busyWindows.length})</Text>
            </HStack>
          </HStack>

          <VStack gap={2}>
            {mergedWindows.map((w, idx) => (
              <HStack
                key={idx}
                gap={3}
                className={[
                  'rounded-md border px-4 py-3',
                  w.kind === 'free'
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
                ].join(' ')}
              >
                <Badge
                  variant={w.kind === 'free' ? 'success' : 'danger'}
                  className='shrink-0'
                >
                  {w.kind === 'free' ? 'Free' : 'Busy'}
                </Badge>
                <Stack gap={0}>
                  <Text className='text-sm font-medium'>
                    {formatDate(w.start_time)}
                  </Text>
                  <HStack gap={1} className='text-muted-foreground text-xs'>
                    <Clock className='h-3 w-3' />
                    <span>
                      {formatTime(w.start_time)} – {formatTime(w.end_time)}
                    </span>
                  </HStack>
                </Stack>
                {/* Busy windows show reason_description (a system label), never private event titles */}
                {w.kind === 'busy' && w.reason_description && (
                  <Text color='muted-foreground' className='ml-auto text-xs'>
                    {w.reason_description}
                  </Text>
                )}
              </HStack>
            ))}
          </VStack>
        </Stack>
      )}
    </Stack>
  );
}
