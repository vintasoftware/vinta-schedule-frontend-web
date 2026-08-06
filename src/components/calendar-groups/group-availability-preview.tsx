'use client';

/**
 * GroupAvailabilityPreview — the "effective availability preview" strip
 * (Phase 6, spec UC-7): shows, per day over a picked range, whether a
 * calendar actually comes back free for this group slot once its base
 * availability, group-scoped windows, and blocks are all resolved.
 *
 * WHY THIS EXISTS — it shapes the empty state. Group-scoped windows/blocks
 * are intersect-only: a save can succeed and change nothing bookable (e.g. a
 * Saturday window on a calendar whose base availability excludes Saturday —
 * see the handoff doc). Without this strip, the admin's only way to check is
 * to open the booking dialog and simulate a booking. So "nothing available
 * in this range" is a LEGITIMATE, EXPECTED result here, not an error — it is
 * rendered as a plain answer (`Alert` default variant, no retry action),
 * deliberately distinct from an actual request failure (`Alert` destructive
 * variant, with a Retry button). Conflating the two would make the
 * intersect-only rule read as broken UI instead of a fact about the
 * configuration.
 *
 * COLLAPSED BY DEFAULT, LAZY QUERY: the group detail page already loads the
 * group, its slots, their rosters, and three concept lists per calendar
 * (slot-roster.tsx) — the plan calls out extra reads on this page as a named
 * risk. This strip renders collapsed and passes `enabled: isOpen` to
 * useGroupAvailabilityPreview, so opening it is the only thing that ever
 * issues the availability request (see this file's test asserting exactly
 * that, and the hook's own module doc comment).
 */

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from 'vinta-schedule-design-system/ui/button';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Input } from 'vinta-schedule-design-system/ui/input';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import { DateTime } from '@/lib/datetime/index';
import { useGroupAvailabilityPreview } from '@/hooks/calendar-groups/use-group-availability-preview';

const DEFAULT_RANGE_DAYS = 7;

function defaultStartDate(): string {
  return DateTime.local().toISODate() ?? '';
}

function defaultEndDate(): string {
  return (
    DateTime.local()
      .plus({ days: DEFAULT_RANGE_DAYS - 1 })
      .toISODate() ?? ''
  );
}

function viewerTimezone(): string {
  return typeof window !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : 'UTC';
}

export interface GroupAvailabilityPreviewProps {
  groupId: number;
  slotId: number;
  calendarId: number;
  calendarName: string;
  /**
   * Initial open state. Defaults to collapsed, per spec. Exposed so
   * Storybook — which has no play function in this repo (Phase 5 removed
   * the repo's only one, with no runner to execute it) — can render the
   * opened states directly instead of simulating the toggle click.
   */
  initialOpen?: boolean;
  /**
   * Overrides for the default "coming seven days" range. Exposed for
   * Storybook and tests so the exact days requested — and therefore the
   * query key a story seeds via `groupAvailabilityPreviewQueryKey` — are
   * deterministic instead of depending on the render-time "today".
   */
  initialStartDate?: string;
  initialEndDate?: string;
  /** Overrides the viewer's detected zone. Exposed for the same reason as the date overrides. */
  initialTimezone?: string;
}

export function GroupAvailabilityPreview({
  groupId,
  slotId,
  calendarId,
  calendarName,
  initialOpen = false,
  initialStartDate,
  initialEndDate,
  initialTimezone,
}: GroupAvailabilityPreviewProps) {
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [startDate, setStartDate] = React.useState(
    () => initialStartDate ?? defaultStartDate()
  );
  const [endDate, setEndDate] = React.useState(
    () => initialEndDate ?? defaultEndDate()
  );
  // Read once at mount, not re-derived every render -- the viewer's zone
  // doesn't change mid-session, and re-deriving it would produce a new
  // string identity each render, defeating the query key's memoization.
  const [timezone] = React.useState(() => initialTimezone ?? viewerTimezone());

  const { days, hasAnyFreeDay, isLoading, isError, refetch } =
    useGroupAvailabilityPreview({
      groupId,
      slotId,
      calendarId,
      startDate,
      endDate,
      timezone,
      enabled: isOpen,
    });

  return (
    <VStack gap={3} data-testid={`availability-preview-${calendarId}`}>
      <HStack justify='between' align='center'>
        <VStack gap={0}>
          <Text size='sm' weight='medium'>
            Effective availability preview
          </Text>
          <Text size='xs' color='muted-foreground'>
            See which days {calendarName} actually comes back free for this
            group slot.
          </Text>
        </VStack>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          data-testid={`availability-preview-toggle-${calendarId}`}
        >
          {isOpen ? (
            <>
              Hide preview
              <ChevronUp aria-hidden />
            </>
          ) : (
            <>
              Show preview
              <ChevronDown aria-hidden />
            </>
          )}
        </Button>
      </HStack>

      {isOpen && (
        <VStack
          gap={3}
          p={3}
          border
          radius='md'
          data-testid={`availability-preview-panel-${calendarId}`}
        >
          <HStack gap={3} wrap align='end'>
            <VStack gap={1}>
              <Label htmlFor={`availability-preview-start-${calendarId}`}>
                From
              </Label>
              <Input
                id={`availability-preview-start-${calendarId}`}
                type='date'
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </VStack>
            <VStack gap={1}>
              <Label htmlFor={`availability-preview-end-${calendarId}`}>
                To
              </Label>
              <Input
                id={`availability-preview-end-${calendarId}`}
                type='date'
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </VStack>
          </HStack>

          {isLoading ? (
            <HStack gap={2} align='center'>
              <Spinner size='xs' label='Loading preview' />
              <Text size='sm' color='muted-foreground'>
                Checking availability…
              </Text>
            </HStack>
          ) : isError ? (
            <Alert
              variant='destructive'
              data-testid={`availability-preview-error-${calendarId}`}
            >
              <AlertTitle>Couldn&apos;t load the preview</AlertTitle>
              <AlertDescription>
                <VStack gap={2}>
                  <Text size='sm'>
                    Something went wrong checking this calendar&apos;s effective
                    availability.
                  </Text>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => refetch()}
                  >
                    Retry
                  </Button>
                </VStack>
              </AlertDescription>
            </Alert>
          ) : !hasAnyFreeDay ? (
            // Legitimate, expected result -- NOT an error. See the module
            // doc comment: intersect-only means a save can succeed and do
            // nothing bookable. Default alert variant, no retry action, so
            // this reads as an answer rather than a failure.
            <Alert data-testid={`availability-preview-empty-${calendarId}`}>
              <AlertTitle>Not available in this range</AlertTitle>
              <AlertDescription>
                {calendarName} doesn&apos;t come back free for this group slot
                on any day between {startDate} and {endDate}. This can happen
                even when the configuration looks right — group-scoped windows
                and blocks only narrow this calendar&apos;s base availability,
                they never widen it.
              </AlertDescription>
            </Alert>
          ) : (
            <HStack
              gap={2}
              wrap
              data-testid={`availability-preview-days-${calendarId}`}
            >
              {days.map((day) => (
                <VStack
                  key={day.date}
                  gap={1}
                  align='center'
                  p={2}
                  border
                  radius='md'
                  data-testid={`availability-preview-day-${day.date}`}
                >
                  <Text size='xs' color='muted-foreground'>
                    {DateTime.fromISO(day.date).toFormat('EEE, MMM d')}
                  </Text>
                  <Badge variant={day.isFree ? 'success' : 'outline'}>
                    {day.isFree ? 'Free' : 'Not free'}
                  </Badge>
                </VStack>
              ))}
            </HStack>
          )}
        </VStack>
      )}
    </VStack>
  );
}
