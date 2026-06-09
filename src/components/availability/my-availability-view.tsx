'use client';

/**
 * MyAvailabilityView — self free/busy for one ISO week (Mon–Sun).
 *
 * Shows a single week at a time and lets the user page between weeks. The
 * viewed week is tracked on the URL (?week=<offset> where 0 = current week,
 * +1 = next week, -1 = last week), so a refresh or deep-link lands on the same
 * week. Must render inside a <Suspense> boundary (useUrlState → useSearchParams).
 *
 * Uses useMyAvailability which derives busy windows from the calendar's
 * unavailable-windows (events + the user's blocked-times, de-duplicated).
 * Requires a default calendar (GET /calendar/default/); otherwise shows an
 * empty state linking to /calendars.
 *
 * Privacy: only available/unavailable windows and system-level reason labels are
 * shown. No private event titles are rendered.
 */

import * as React from 'react';
import Link from 'next/link';
import { CalendarOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VStack, HStack, Stack, Text, Heading } from '@/components/layout';
import { useMyAvailability } from '@/hooks/availability/use-my-availability';
import { useUrlState } from '@/hooks/use-url-state';
import { FreeBusyList } from './free-busy-list';
import { DateTime, eventRange } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// MyAvailabilityView
// ---------------------------------------------------------------------------

export function MyAvailabilityView() {
  const [weekParam, setWeekParam] = useUrlState('week', '0');
  const weekOffset = React.useMemo(() => {
    const n = parseInt(weekParam, 10);
    return Number.isFinite(n) ? n : 0;
  }, [weekParam]);

  // Compute the ISO week (Mon–Sun) for the selected offset. DateTime.now() is
  // read inside the memo; the result only recomputes when the offset changes.
  const { range, weekLabel } = React.useMemo(() => {
    const zone = DateTime.now().zoneName ?? 'UTC';
    const anchor = DateTime.now().plus({ weeks: weekOffset });
    const r = eventRange('week', anchor, zone);
    return {
      range: {
        startDatetime: r.start.toISO() ?? '',
        endDatetime: r.end.toISO() ?? '',
      },
      weekLabel: `${r.start.toFormat('MMM d')} – ${r.end.toFormat('MMM d, yyyy')}`,
    };
  }, [weekOffset]);

  const {
    defaultCalendar,
    hasDefault,
    freeWindows,
    busyWindows,
    isLoading,
    isError,
  } = useMyAvailability(range);

  const goToWeek = (offset: number) => setWeekParam(String(offset));

  const relativeLabel =
    weekOffset === 0
      ? 'This week'
      : weekOffset === 1
        ? 'Next week'
        : weekOffset === -1
          ? 'Last week'
          : weekOffset > 0
            ? `In ${weekOffset} weeks`
            : `${Math.abs(weekOffset)} weeks ago`;

  if (!hasDefault && !isLoading) {
    return (
      <Stack gap={3} className='py-4'>
        <VStack gap={2} className='items-center text-center'>
          <CalendarOff className='text-muted-foreground h-8 w-8' aria-hidden />
          <Text color='muted-foreground'>
            No default calendar yet — connect or import a calendar.
          </Text>
          <Button variant='link' size='sm' className='p-0' asChild>
            <Link href='/calendars'>Go to Calendars &rarr;</Link>
          </Button>
        </VStack>
      </Stack>
    );
  }

  return (
    <Stack gap={4}>
      {/* Week pager — makes the single-week scope explicit and navigable. */}
      <HStack gap={3} className='items-center justify-between'>
        <VStack gap={0}>
          <Heading size='sm'>{relativeLabel}</Heading>
          <Text size='sm' color='muted-foreground'>
            {weekLabel}
          </Text>
        </VStack>
        <HStack gap={2} className='items-center'>
          {weekOffset !== 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => goToWeek(0)}
              aria-label='Go to this week'
            >
              This week
            </Button>
          )}
          <Button
            variant='outline'
            size='icon'
            onClick={() => goToWeek(weekOffset - 1)}
            aria-label='Previous week'
          >
            <ChevronLeft className='size-4' aria-hidden />
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={() => goToWeek(weekOffset + 1)}
            aria-label='Next week'
          >
            <ChevronRight className='size-4' aria-hidden />
          </Button>
        </HStack>
      </HStack>

      {isLoading ? (
        <VStack gap={2}>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className='h-12 w-full rounded-md' />
          ))}
        </VStack>
      ) : (
        <FreeBusyList
          freeWindows={freeWindows}
          busyWindows={busyWindows}
          isLoading={false}
          isError={isError}
          calendarLabel={defaultCalendar?.name}
        />
      )}

      <Text size='xs' color='muted-foreground'>
        Showing one week at a time. Includes your events and blocked times.
      </Text>
    </Stack>
  );
}
