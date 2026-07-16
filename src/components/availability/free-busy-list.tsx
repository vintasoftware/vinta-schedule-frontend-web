'use client';

/**
 * FreeBusyList — shared rendering of merged free/busy windows.
 *
 * Renders the free/busy badge rows, date/time formatting, legend, and empty
 * state that were previously inline in UserAvailabilityView. Accepts a typed
 * busy-entry shape so it works for both event-only (UserAvailabilityView) and
 * events+blocks (MyAvailabilityView) callers.
 *
 * Privacy: no event titles are rendered — the data types (AvailableTimeWindow,
 * BusyEntry) do not carry private event detail.
 */

import { Clock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from 'vinta-schedule-design-system/ui/alert';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  Box,
  HStack,
  VStack,
  Stack,
  Text,
  Heading,
} from 'vinta-schedule-design-system/layout';
import type { AvailableTimeWindow } from '@/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Types
// ---------------------------------------------------------------------------

/** Minimal busy window shape — compatible with both UnavailableTimeWindow
 *  and the BusyEntry type from useMyAvailability. */
export interface BusyWindowEntry {
  id: number;
  start_time: string;
  end_time: string;
  reason_description: string;
}

export interface FreeBusyListProps {
  freeWindows: AvailableTimeWindow[];
  busyWindows: BusyWindowEntry[];
  isLoading: boolean;
  isError: boolean;
  /** Optional label shown in the list heading, e.g. a calendar id or name. */
  calendarLabel?: string;
}

// ---------------------------------------------------------------------------
// LoadingSkeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <VStack gap={2}>
      {[1, 2, 3].map((n) => (
        <Skeleton key={n} height={48} width='full' radius='md' />
      ))}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// FreeBusyList
// ---------------------------------------------------------------------------

type WindowEntry =
  | { kind: 'free'; start_time: string; end_time: string }
  | {
      kind: 'busy';
      start_time: string;
      end_time: string;
      reason_description: string;
    };

export function FreeBusyList({
  freeWindows,
  busyWindows,
  isLoading,
  isError,
  calendarLabel,
}: FreeBusyListProps) {
  const totalWindows = freeWindows.length + busyWindows.length;

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

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <Alert variant='destructive'>
        <Icon icon={AlertCircle} />
        <AlertDescription>
          Failed to load availability. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (totalWindows === 0) {
    return (
      <Text color='muted-foreground' py={4} align='center'>
        No availability windows found for this range.
      </Text>
    );
  }

  return (
    <Stack gap={3}>
      {calendarLabel && (
        <Heading size='sm'>Free/busy for {calendarLabel}</Heading>
      )}
      <HStack gap={4}>
        <HStack gap={1}>
          <Box
            display='inline-block'
            width={12}
            height={12}
            radius='sm'
            bg='green-500'
          />
          <Text size='sm'>Free ({freeWindows.length})</Text>
        </HStack>
        <HStack gap={1}>
          <Box
            display='inline-block'
            width={12}
            height={12}
            radius='sm'
            bg='red-500'
          />
          <Text size='sm'>Busy ({busyWindows.length})</Text>
        </HStack>
      </HStack>

      <VStack gap={2}>
        {mergedWindows.map((w, idx) => (
          <HStack
            key={idx}
            gap={3}
            px={4}
            py={3}
            radius='md'
            /* Free/busy tints need a light + dark pair (`dark:` variants), which
               no token prop can express — the DS `border`/`bg` props emit a
               single inline value. */
            className={
              w.kind === 'free'
                ? 'border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
                : 'border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
            }
          >
            {/* shrink-0: Badge is a shadcn atom with no flex-item prop. */}
            <Badge
              variant={w.kind === 'free' ? 'success' : 'danger'}
              className='shrink-0'
            >
              {w.kind === 'free' ? 'Free' : 'Busy'}
            </Badge>
            <Stack gap={0}>
              <Text size='sm' weight='medium'>
                {formatDate(w.start_time)}
              </Text>
              <HStack gap={1}>
                <Icon icon={Clock} size='xs' color='muted-foreground' />
                <Text size='xs' color='muted-foreground'>
                  {formatTime(w.start_time)} – {formatTime(w.end_time)}
                </Text>
              </HStack>
            </Stack>
            {/* Busy windows show reason_description (a system label), never private event titles */}
            {w.kind === 'busy' && w.reason_description && (
              <Text color='muted-foreground' size='xs' ml='auto'>
                {w.reason_description}
              </Text>
            )}
          </HStack>
        ))}
      </VStack>
    </Stack>
  );
}
