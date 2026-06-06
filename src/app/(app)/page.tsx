'use client';

/**
 * Dashboard — at-a-glance member overview.
 *
 * Tiles are independent: each owns its own loading skeleton + empty state so a
 * slow query on one tile never blocks the others.
 *
 * Role-agnostic: no admin gates. Everything here is member-visible.
 */

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarDays, CalendarCheck, Clock, Zap } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Stack } from '@/components/layout/stack';
import { VStack, HStack } from '@/components/layout/flex';
import { Text } from '@/components/layout/text';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useProfile } from '@/hooks/users/use-profile';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useBlockedTimes } from '@/hooks/availability/use-blocked-times';
import { useRequestCalendarSync } from '@/hooks/calendars/use-request-calendar-sync';

import { DateTime, eventRange, zonedFormat } from '@/lib/datetime/index';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum events shown in the "Up next" tile. */
const UP_NEXT_CAP = 8;
/** Maximum calendars shown in the "My calendars" tile. */
const CALENDARS_CAP = 5;

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { profile, isLoading: profileLoading } = useProfile();

  const anchor = React.useMemo(() => DateTime.now(), []);
  const range = React.useMemo(
    () => eventRange('list', anchor, anchor.zoneName ?? 'UTC'),
    [anchor]
  );

  const {
    events,
    isLoading: eventsLoading,
    isError: eventsError,
  } = useCalendarEvents({ range });

  const {
    calendars,
    totalCount: calendarTotal,
    isLoading: calendarsLoading,
    isError: calendarsError,
  } = useMyCalendars({ ...DEFAULT_DATA_TABLE_QUERY, pageSize: 100 });

  const { blockedTimes, isLoading: blockedLoading } = useBlockedTimes();

  const { requestSync, requestSyncMutation } = useRequestCalendarSync();

  const firstName =
    !profileLoading && profile?.first_name ? profile.first_name : null;

  const upNextEvents = React.useMemo(
    () =>
      [...events]
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, UP_NEXT_CAP),
    [events]
  );

  const visibleCalendars = calendars.slice(0, CALENDARS_CAP);

  const [syncingIds, setSyncingIds] = React.useState<Set<number>>(new Set());

  const handleSync = React.useCallback(
    async (calendarId: number) => {
      setSyncingIds((prev) => new Set(prev).add(calendarId));
      try {
        await requestSync(calendarId);
        toast.success('Sync started');
      } catch {
        toast.error('Sync failed — please try again');
      } finally {
        setSyncingIds((prev) => {
          const next = new Set(prev);
          next.delete(calendarId);
          return next;
        });
      }
    },
    [requestSync]
  );

  return (
    <Stack gap={6}>
      {/* Greeting */}
      <PageHeader
        title={
          profileLoading
            ? 'Dashboard'
            : firstName
              ? `Good day, ${firstName}`
              : 'Welcome'
        }
        description='Your at-a-glance schedule overview.'
      />

      {/* Tile grid */}
      <div className='grid gap-4 @xl/content:grid-cols-2 @4xl/content:grid-cols-3'>
        {/* ---- Up next (spans 2 cols on wide containers) ---- */}
        <div className='@4xl/content:col-span-2'>
          <UpNextTile
            events={upNextEvents}
            isLoading={eventsLoading}
            isError={eventsError}
          />
        </div>

        {/* ---- My calendars ---- */}
        <MyCalendarsTile
          calendars={visibleCalendars}
          totalCount={calendarTotal}
          isLoading={calendarsLoading}
          isError={calendarsError}
          syncingIds={syncingIds}
          onSync={handleSync}
          isMutating={requestSyncMutation.isPending}
        />

        {/* ---- Availability ---- */}
        <AvailabilityTile
          blockedCount={blockedTimes.length}
          isLoading={blockedLoading}
        />

        {/* ---- Quick actions ---- */}
        <QuickActionsTile />
      </div>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Tile — Up next
// ---------------------------------------------------------------------------

interface UpNextTileProps {
  events: Array<{
    id: string;
    title: string;
    startDt: DateTime;
    timezone: string;
    timezoneLabel: string;
  }>;
  isLoading: boolean;
  isError: boolean;
}

function UpNextTile({ events, isLoading, isError }: UpNextTileProps) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <CalendarDays className='text-muted-foreground size-4' aria-hidden />
          <CardTitle className='text-base'>Up next</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <VStack gap={3}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </VStack>
        ) : isError ? (
          <Text size='sm' color='muted-foreground'>
            Unable to load events.
          </Text>
        ) : events.length === 0 ? (
          <VStack gap={2}>
            <Text size='sm' color='muted-foreground'>
              No upcoming events
            </Text>
            <Button variant='link' size='sm' className='p-0' asChild>
              <Link href='/calendars'>Connect a calendar</Link>
            </Button>
          </VStack>
        ) : (
          <VStack gap={0}>
            {events.map((ev) => {
              const dayTime = zonedFormat(
                ev.startDt.toISO() ?? '',
                ev.timezone,
                'EEE, MMM d · h:mm a'
              );
              return (
                <div
                  key={ev.id}
                  className='border-border flex items-start gap-3 border-b py-2.5 last:border-b-0'
                >
                  <VStack gap={0} className='min-w-0 flex-1'>
                    <Text size='sm' className='font-medium'>
                      {ev.title}
                    </Text>
                    <Text size='xs' color='muted-foreground'>
                      {dayTime}
                    </Text>
                  </VStack>
                  <Text
                    size='xs'
                    color='muted-foreground'
                    className='shrink-0 pt-0.5'
                  >
                    {ev.timezoneLabel}
                  </Text>
                </div>
              );
            })}
          </VStack>
        )}
      </CardContent>

      {!isLoading && !isError && (
        <CardFooter>
          <Button variant='link' size='sm' className='p-0' asChild>
            <Link href='/events'>View all events &rarr;</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tile — My calendars
// ---------------------------------------------------------------------------

interface MyCalendarsTileProps {
  calendars: Array<{ id: number; name: string; provider: string }>;
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  syncingIds: Set<number>;
  onSync: (id: number) => void;
  isMutating: boolean;
}

function MyCalendarsTile({
  calendars,
  totalCount,
  isLoading,
  isError,
  syncingIds,
  onSync,
}: MyCalendarsTileProps) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2} className='justify-between'>
          <HStack gap={2}>
            <CalendarCheck
              className='text-muted-foreground size-4'
              aria-hidden
            />
            <CardTitle className='text-base'>My calendars</CardTitle>
          </HStack>
          {!isLoading && !isError && (
            <Text size='xs' color='muted-foreground'>
              {totalCount} connected
            </Text>
          )}
        </HStack>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <VStack gap={3}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-9 w-full' />
            ))}
          </VStack>
        ) : isError ? (
          <Text size='sm' color='muted-foreground'>
            Unable to load calendars.
          </Text>
        ) : calendars.length === 0 ? (
          <VStack gap={2}>
            <Text size='sm' color='muted-foreground'>
              No calendars connected
            </Text>
            <Button variant='link' size='sm' className='p-0' asChild>
              <Link href='/calendars'>Connect a calendar</Link>
            </Button>
          </VStack>
        ) : (
          <VStack gap={0}>
            {calendars.map((cal) => (
              <div
                key={cal.id}
                className='border-border flex items-center gap-2 border-b py-2 last:border-b-0'
              >
                <VStack gap={0} className='min-w-0 flex-1'>
                  <Text size='sm' className='font-medium'>
                    {cal.name}
                  </Text>
                  <Text
                    size='xs'
                    color='muted-foreground'
                    className='capitalize'
                  >
                    {cal.provider}
                  </Text>
                </VStack>
                <Button
                  variant='outline'
                  size='xs'
                  disabled={syncingIds.has(cal.id)}
                  onClick={() => onSync(cal.id)}
                >
                  {syncingIds.has(cal.id) ? 'Syncing…' : 'Sync'}
                </Button>
              </div>
            ))}
          </VStack>
        )}
      </CardContent>

      {!isLoading && !isError && (
        <CardFooter>
          <Button variant='link' size='sm' className='p-0' asChild>
            <Link href='/calendars'>Manage calendars &rarr;</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tile — Availability
// ---------------------------------------------------------------------------

interface AvailabilityTileProps {
  blockedCount: number;
  isLoading: boolean;
}

function AvailabilityTile({ blockedCount, isLoading }: AvailabilityTileProps) {
  return (
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <Clock className='text-muted-foreground size-4' aria-hidden />
          <CardTitle className='text-base'>Availability</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className='h-8 w-3/4' />
        ) : (
          <Text size='sm' color='muted-foreground'>
            {blockedCount === 0
              ? 'No blocked windows'
              : `${blockedCount} blocked ${blockedCount === 1 ? 'window' : 'windows'}`}
          </Text>
        )}
      </CardContent>

      <CardFooter>
        <Button variant='link' size='sm' className='p-0' asChild>
          <Link href='/availability'>Manage availability &rarr;</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tile — Quick actions
// ---------------------------------------------------------------------------

function QuickActionsTile() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <Zap className='text-muted-foreground size-4' aria-hidden />
          <CardTitle className='text-base'>Quick actions</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        <VStack gap={2}>
          <Button variant='outline' size='sm' className='w-full' asChild>
            <Link href='/calendars'>Connect calendar</Link>
          </Button>
          <Button variant='outline' size='sm' className='w-full' asChild>
            <Link href='/availability'>Set availability</Link>
          </Button>
          <Button variant='outline' size='sm' className='w-full' asChild>
            <Link href='/events'>View events</Link>
          </Button>
        </VStack>
      </CardContent>
    </Card>
  );
}
