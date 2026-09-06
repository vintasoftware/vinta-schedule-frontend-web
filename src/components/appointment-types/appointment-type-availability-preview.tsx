'use client';

/**
 * AppointmentTypeAvailabilityPreview — the "effective availability preview" strip
 * (Phase 6, spec UC-7): shows, per day over a picked range, whether a
 * calendar actually comes back free for this appointment type slot once its base
 * availability, appointment-type-scoped windows, and blocks are all resolved.
 *
 * WHY THIS EXISTS — it shapes the empty state. Appointment Type-scoped windows/blocks
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
 * THREE DISTINCT "NOT A FAILURE" STATES, not one: `useAppointmentTypeAvailabilityPreview`
 * probes each day's OWN declared appointment-type-scoped window interval, not the
 * whole day (see the hook's module doc comment for why a full-day probe
 * would lie). That means "nothing bookable" can mean three different
 * things, each rendered distinctly:
 *  - the picked range itself is invalid (`endDate` before `startDate` —
 *    easy to produce mid-edit in the date inputs) — no day was ever
 *    evaluated, so this must not read as "never free";
 *  - this calendar has no representable appointment-type-scoped window anywhere in
 *    the picked range at all — there was nothing to probe, so "not
 *    available" would misleadingly imply a configuration that doesn't
 *    help, when there IS no configuration to speak of (base availability
 *    governs it entirely);
 *  - every probed day came back not free — the genuine intersect-only
 *    narrowing result UC-7 exists to surface.
 * A day can also be individually `'unconfigured'` inside an otherwise mixed
 * range (some days configured, some not) — rendered with its own badge
 * plus an explanatory note, rather than silently reporting it "not free".
 *
 * COLLAPSED BY DEFAULT, LAZY QUERY: the appointment type detail page already loads the
 * appointment type, its slots, their rosters, and three concept lists per calendar
 * (slot-roster.tsx) — the plan calls out extra reads on this page as a named
 * risk. This strip renders collapsed and passes `enabled: isOpen` to
 * useAppointmentTypeAvailabilityPreview, so opening it is the only thing that ever
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
import { useAppointmentTypeAvailabilityPreview } from '@/hooks/appointment-types/use-appointment-type-availability-preview';

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

export interface AppointmentTypeAvailabilityPreviewProps {
  appointmentTypeId: number;
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
   * query key a story seeds via `appointmentTypeAvailabilityPreviewQueryKey` — are
   * deterministic instead of depending on the render-time "today".
   */
  initialStartDate?: string;
  initialEndDate?: string;
  /** Overrides the viewer's detected zone. Exposed for the same reason as the date overrides. */
  initialTimezone?: string;
}

export function AppointmentTypeAvailabilityPreview({
  appointmentTypeId,
  slotId,
  calendarId,
  calendarName,
  initialOpen = false,
  initialStartDate,
  initialEndDate,
  initialTimezone,
}: AppointmentTypeAvailabilityPreviewProps) {
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
    useAppointmentTypeAvailabilityPreview({
      appointmentTypeId,
      slotId,
      calendarId,
      startDate,
      endDate,
      timezone,
      enabled: isOpen,
    });

  // `days` is empty ONLY for an invalid/inverted picked range (see
  // buildDayPlans) -- distinct from a genuinely-queried range that came
  // back with zero free days, which still has one entry per day. Conflating
  // the two would tell an admin who mis-edited the date fields "this
  // calendar is never free" instead of "pick a valid range" (SHOULD-FIX).
  const isInvalidRange = days.length === 0;
  // Every day in range has no representable appointment-type-scoped window for this
  // calendar/slot at all -- there was nothing to probe, so this reads
  // differently from "narrowed away by configuration" (see the module doc
  // comment).
  const isEntirelyUnconfigured =
    days.length > 0 && days.every((day) => day.status === 'unconfigured');
  const hasAnyUnconfiguredDay = days.some(
    (day) => day.status === 'unconfigured'
  );

  return (
    <VStack gap={3} data-testid={`availability-preview-${calendarId}`}>
      <HStack justify='between' align='center'>
        <VStack gap={0}>
          <Text size='sm' weight='medium'>
            Effective availability preview
          </Text>
          <Text size='xs' color='muted-foreground'>
            See which days {calendarName} actually comes back free for this
            appointment type slot.
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
          ) : isInvalidRange ? (
            // No day was ever evaluated -- must not read as "never free"
            // (SHOULD-FIX). `Input min` only guards the native picker;
            // editing "From" past an already-set "To" still gets here.
            <Alert
              data-testid={`availability-preview-invalid-range-${calendarId}`}
            >
              <AlertTitle>Pick a valid date range</AlertTitle>
              <AlertDescription>
                The &quot;To&quot; date must be on or after the &quot;From&quot;
                date.
              </AlertDescription>
            </Alert>
          ) : isEntirelyUnconfigured ? (
            // Nothing to probe: this calendar has no representable
            // appointment-type-scoped window anywhere in the picked range. Distinct
            // from "narrowed away by configuration" below -- there IS no
            // configuration here, base availability governs it entirely.
            <Alert
              data-testid={`availability-preview-unconfigured-${calendarId}`}
            >
              <AlertTitle>
                No appointment-type-scoped configuration for this slot
              </AlertTitle>
              <AlertDescription>
                {calendarName} has no appointment-type-scoped availability
                window configured between {startDate} and {endDate} for this
                appointment type slot. There&apos;s nothing to preview here —
                availability is governed entirely by the calendar&apos;s base
                hours.
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
                {calendarName} doesn&apos;t come back free for this appointment
                type slot on any day between {startDate} and {endDate}. This can
                happen even when the configuration looks right —
                appointment-type-scoped windows and blocks only narrow this
                calendar&apos;s base availability, they never widen it.
              </AlertDescription>
            </Alert>
          ) : (
            <VStack gap={2}>
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
                    <Badge
                      variant={
                        day.status === 'free'
                          ? 'success'
                          : day.status === 'unconfigured'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {day.status === 'free'
                        ? 'Free'
                        : day.status === 'unconfigured'
                          ? 'No config'
                          : 'Not free'}
                    </Badge>
                  </VStack>
                ))}
              </HStack>
              {hasAnyUnconfiguredDay && (
                <Text
                  size='xs'
                  color='muted-foreground'
                  data-testid={`availability-preview-unconfigured-note-${calendarId}`}
                >
                  Days marked &quot;No config&quot; have no
                  appointment-type-scoped window for this calendar in this slot
                  — availability there is governed entirely by the
                  calendar&apos;s base hours.
                </Text>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </VStack>
  );
}
