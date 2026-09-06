'use client';

/**
 * OrphanedBookingsAlert — surfaces the confirmed future bookings a
 * appointment-type-scoped write stranded (spec UC-5).
 *
 * `OrphanedBooking` is deliberately this component's OWN shape, not a
 * generated client type: `AppointmentTypeScopedAvailabilityOrphanedBooking` (windows,
 * Phase 3a) and `AppointmentTypeScopedBlockOrphanedBooking` (blocks, Phase 4) are
 * structurally identical -- `{ id, calendar_id, title, start_time,
 * end_time }` -- but nominally distinct generated types. Binding this
 * component to either one would force Phase 4 to either duplicate it or
 * cast across the two; a caller on either side passes its own hook result's
 * `orphaned_bookings` array straight through instead (see
 * appointment-type-window-grid.tsx's onSubmit, which does exactly that for windows).
 *
 * Orphan detection FREQUENCY differs between windows and blocks (windows:
 * only the calendar's first window in the slot, and narrowing updates;
 * blocks: every create and update) -- this component does not assume
 * either. It only ever renders what its caller collected for one save.
 *
 * No per-booking-detail route exists in this app (events are opened from an
 * in-page list/dialog in events-view.tsx, never addressable by a single
 * event's id via a route or query param). A precise link straight to one
 * booking would therefore either invent a route that doesn't exist or 404.
 * `/events` DOES accept a `?calendar=<id>` scope param (events-view.tsx),
 * though, so each entry links there -- scoping the admin to the right
 * calendar's agenda instead of leaving them to search manually. That is not
 * the same as a link to the specific booking (spec UC-5 asks for "a link to
 * the booking"), so don't overstate it as one.
 *
 * Nothing about a listed booking is modified by rendering this alert, and
 * the copy says so explicitly -- this is a heads-up for manual follow-up,
 * never an automatic action.
 */

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import {
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { zonedFormat } from '@/lib/datetime/index';

/**
 * Minimal identification of a booking an appointment-type-scoped write orphaned --
 * matches the shape of both `AppointmentTypeScopedAvailabilityOrphanedBooking` and
 * `AppointmentTypeScopedBlockOrphanedBooking`. See the module doc comment for why this
 * isn't one of those generated types directly.
 */
export interface OrphanedBooking {
  id: number;
  calendar_id: number;
  title: string;
  start_time: string;
  end_time: string;
  /**
   * IANA zone the write that orphaned this booking was made in -- the
   * generated booking shape carries no timezone of its own, so the caller
   * (the write's `onSubmit`, which knows exactly which zone produced this
   * outcome) fills it in. Falls back to UTC when absent rather than assuming
   * it, since a caller with no zone to offer is a real (if unlikely) case.
   */
  timezone?: string;
}

export interface OrphanedBookingsAlertProps {
  /** One entry per stranded booking. Render nothing when empty. */
  bookings: readonly OrphanedBooking[];
  /**
   * Display name of the calendar these bookings belong to. Falls back to
   * `Calendar #{calendar_id}` when absent -- a caller that hasn't threaded
   * a name through yet (e.g. an early Phase 4 caller) still renders
   * something actionable rather than nothing.
   */
  calendarName?: string;
  /** Called when the admin dismisses the alert. */
  onDismiss?: () => void;
}

function OrphanedBookingRow({
  booking,
  calendarName,
}: {
  booking: OrphanedBooking;
  calendarName?: string;
}) {
  // A booking's own write knows exactly which zone produced it (see the
  // `timezone` field's doc comment) -- fall back to UTC only when a caller
  // genuinely has none to offer, same convention conflict-surface.tsx's
  // ConflictWindowDetail uses for a shape that truly never carries one.
  const zone = booking.timezone ?? 'UTC';
  const start = zonedFormat(booking.start_time, zone, 'MMM d, yyyy, h:mm a');
  const end = zonedFormat(booking.end_time, zone, 'h:mm a');

  return (
    <Stack
      gap={0}
      p={2}
      border
      radius='md'
      data-testid={`orphaned-booking-${booking.id}`}
    >
      {/* className is an escape hatch here because TextLink has no `weight`
          variant yet -- same precedent as appointment-types-table.tsx's name column. */}
      <TextLink asChild size='sm' className='font-medium'>
        <Link href={`/events?calendar=${booking.calendar_id}`}>
          {booking.title}
        </Link>
      </TextLink>
      <Text size='xs' color='muted-foreground'>
        {start} – {end}
      </Text>
      <Text size='xs' color='muted-foreground'>
        {calendarName ?? `Calendar #${booking.calendar_id}`}
      </Text>
    </Stack>
  );
}

export function OrphanedBookingsAlert({
  bookings,
  calendarName,
  onDismiss,
}: OrphanedBookingsAlertProps) {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || bookings.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Alert variant='warning' data-testid='orphaned-bookings-alert'>
      <HStack gap={3} align='start' justify='between'>
        <VStack gap={1} grow basis={0}>
          <AlertTitle>
            {bookings.length === 1
              ? 'This change stranded 1 booking'
              : `This change stranded ${bookings.length} bookings`}
          </AlertTitle>
          <AlertDescription>
            Nothing was cancelled. The bookings below no longer fit this
            calendar&apos;s availability -- review each one and cancel or
            reschedule it by hand if needed.
          </AlertDescription>
        </VStack>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          onClick={handleDismiss}
          aria-label='Dismiss'
        >
          <X aria-hidden />
        </Button>
      </HStack>
      <Stack gap={2} mt={3}>
        {bookings.map((booking) => (
          <OrphanedBookingRow
            key={booking.id}
            booking={booking}
            calendarName={calendarName}
          />
        ))}
      </Stack>
    </Alert>
  );
}
