'use client';

/**
 * MyAvailabilityView — self free/busy over the next 7 days.
 *
 * Uses useMyAvailability which merges calendar events + blocked times into a
 * unified busy list. Requires the user to have a default calendar (imported
 * via GET /calendar/default/). When no default calendar is set, shows an
 * empty state with a link to /calendars.
 *
 * Privacy: only available/unavailable time windows and system-level blocked
 * time reasons are shown. No private event titles are rendered.
 */

import * as React from 'react';
import Link from 'next/link';
import { CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VStack, Stack, Text } from '@/components/layout';
import { useMyAvailability } from '@/hooks/availability/use-my-availability';
import { FreeBusyList } from './free-busy-list';
import { DateTime, eventRange } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// MyAvailabilityView
// ---------------------------------------------------------------------------

export function MyAvailabilityView() {
  // Compute next-7-days range once on mount — stable reference via useMemo.
  const range = React.useMemo(() => {
    const r = eventRange(
      'list',
      DateTime.now(),
      DateTime.now().zoneName ?? 'UTC'
    );
    return {
      startDatetime: r.start.toISO() ?? '',
      endDatetime: r.end.toISO() ?? '',
    };
  }, []);

  const {
    defaultCalendar,
    hasDefault,
    freeWindows,
    busyWindows,
    isLoading,
    isError,
  } = useMyAvailability(range);

  if (isLoading) {
    return (
      <VStack gap={2}>
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className='h-12 w-full rounded-md' />
        ))}
      </VStack>
    );
  }

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
      <FreeBusyList
        freeWindows={freeWindows}
        busyWindows={busyWindows}
        isLoading={false}
        isError={isError}
        calendarLabel={defaultCalendar?.name}
      />
      <Text size='xs' color='muted-foreground'>
        Includes your events and blocked times.
      </Text>
    </Stack>
  );
}
