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

import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { VStack, HStack } from 'vinta-schedule-design-system/layout/flex';
import { Grid, GridItem } from 'vinta-schedule-design-system/layout/grid';
import { Text } from 'vinta-schedule-design-system/layout/text';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';

import { useProfile } from '@/hooks/users/use-profile';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useMyAvailability } from '@/hooks/availability/use-my-availability';
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

  // Availability tile: self free/busy over next 7 days (events + blocks).
  const next7dRange = React.useMemo(
    () => ({
      startDatetime: range.start.toISO() ?? '',
      endDatetime: range.end.toISO() ?? '',
    }),
    [range]
  );

  const {
    hasDefault: availHasDefault,
    freeWindows,
    busyWindows,
    isLoading: availLoading,
  } = useMyAvailability(next7dRange);

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

      {/* Tile grid. The column counts react to the CONTENT container's width
          (@container/content on the AppShell main), not the viewport —
          collapsing the sidebar widens the container and the tiles reflow off
          that. */}
      <Grid columns={{ base: 1, '@xl/content': 2, '@4xl/content': 3 }} gap={4}>
        {/* ---- Up next (spans 2 cols on wide containers) ---- */}
        <GridItem span={{ base: 1, '@4xl/content': 2 }}>
          <UpNextTile
            events={upNextEvents}
            isLoading={eventsLoading}
            isError={eventsError}
          />
        </GridItem>

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
          hasDefault={availHasDefault}
          busyCount={busyWindows.length}
          freeCount={freeWindows.length}
          isLoading={availLoading}
        />

        {/* ---- Quick actions ---- */}
        <QuickActionsTile />
      </Grid>
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
    // `h-full` — Card exposes no height prop; the tile must fill its grid row.
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <Icon icon={CalendarDays} size='sm' color='muted-foreground' />
          {/* `text-base` — CardTitle exposes no size prop. */}
          <CardTitle className='text-base'>Up next</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <VStack gap={3}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={40} width='full' />
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
            <TextLink size='sm' asChild>
              <Link href='/calendars'>Connect a calendar</Link>
            </TextLink>
          </VStack>
        ) : (
          <VStack gap={0}>
            {events.map((ev, i) => {
              const dayTime = zonedFormat(
                ev.startDt.toISO() ?? '',
                ev.timezone,
                'EEE, MMM d · h:mm a'
              );
              return (
                <HStack
                  key={ev.id}
                  align='start'
                  gap={3}
                  py={3}
                  // The rule sits between rows — the `last:border-b-0` idiom,
                  // expressed as data rather than as a CSS pseudo-selector.
                  borderBottom={i < events.length - 1}
                >
                  <VStack gap={0} minWidth={0} grow>
                    <Text size='sm' weight='medium'>
                      {ev.title}
                    </Text>
                    <Text size='xs' color='muted-foreground'>
                      {dayTime}
                    </Text>
                  </VStack>
                  <Text size='xs' color='muted-foreground' shrink={0} pt={1}>
                    {ev.timezoneLabel}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        )}
      </CardContent>

      {!isLoading && !isError && (
        <CardFooter>
          <TextLink size='sm' asChild>
            <Link href='/events'>View all events &rarr;</Link>
          </TextLink>
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
    // `h-full` — Card exposes no height prop; the tile must fill its grid row.
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2} justify='between'>
          <HStack gap={2}>
            <Icon icon={CalendarCheck} size='sm' color='muted-foreground' />
            {/* `text-base` — CardTitle exposes no size prop. */}
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
              <Skeleton key={i} height={36} width='full' />
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
            <TextLink size='sm' asChild>
              <Link href='/calendars'>Connect a calendar</Link>
            </TextLink>
          </VStack>
        ) : (
          <VStack gap={0}>
            {calendars.map((cal, i) => (
              <HStack
                key={cal.id}
                gap={2}
                py={2}
                borderBottom={i < calendars.length - 1}
              >
                <VStack gap={0} minWidth={0} grow>
                  <Text size='sm' weight='medium'>
                    {cal.name}
                  </Text>
                  {/* `capitalize` — Text has `uppercase` but no `capitalize`
                      prop. TODO(ds-gap): add a `transform`/`capitalize` prop. */}
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
              </HStack>
            ))}
          </VStack>
        )}
      </CardContent>

      {!isLoading && !isError && (
        <CardFooter>
          <TextLink size='sm' asChild>
            <Link href='/calendars'>Manage calendars &rarr;</Link>
          </TextLink>
        </CardFooter>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tile — Availability
// ---------------------------------------------------------------------------

interface AvailabilityTileProps {
  hasDefault: boolean;
  busyCount: number;
  freeCount: number;
  isLoading: boolean;
}

function AvailabilityTile({
  hasDefault,
  busyCount,
  freeCount,
  isLoading,
}: AvailabilityTileProps) {
  return (
    // `h-full` — Card exposes no height prop; the tile must fill its grid row.
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <Icon icon={Clock} size='sm' color='muted-foreground' />
          {/* `text-base` — CardTitle exposes no size prop. */}
          <CardTitle className='text-base'>Availability</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton height={32} width='75%' />
        ) : !hasDefault ? (
          <VStack gap={2}>
            <Text size='sm' color='muted-foreground'>
              No default calendar
            </Text>
            <TextLink size='sm' asChild>
              <Link href='/calendars'>Connect a calendar</Link>
            </TextLink>
          </VStack>
        ) : (
          <Text size='sm' color='muted-foreground'>
            Next 7 days · {busyCount} busy · {freeCount} free
          </Text>
        )}
      </CardContent>

      <CardFooter>
        <TextLink size='sm' asChild>
          <Link href='/availability'>Manage availability &rarr;</Link>
        </TextLink>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tile — Quick actions
// ---------------------------------------------------------------------------

function QuickActionsTile() {
  return (
    // `h-full` — Card exposes no height prop; the tile must fill its grid row.
    <Card className='h-full'>
      <CardHeader>
        <HStack gap={2}>
          <Icon icon={Zap} size='sm' color='muted-foreground' />
          {/* `text-base` — CardTitle exposes no size prop. */}
          <CardTitle className='text-base'>Quick actions</CardTitle>
        </HStack>
      </CardHeader>

      <CardContent>
        <VStack gap={2}>
          <Button variant='outline' size='sm' fullWidth asChild>
            <Link href='/calendars'>Connect calendar</Link>
          </Button>
          <Button variant='outline' size='sm' fullWidth asChild>
            <Link href='/availability'>Set availability</Link>
          </Button>
          <Button variant='outline' size='sm' fullWidth asChild>
            <Link href='/events'>View events</Link>
          </Button>
        </VStack>
      </CardContent>
    </Card>
  );
}
