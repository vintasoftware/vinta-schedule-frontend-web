'use client';

/**
 * OrphanedBookingsAlert — surfaces the confirmed future bookings a
 * group-scoped write stranded (spec UC-5).
 *
 * `OrphanedBooking` is deliberately this component's OWN shape, not a
 * generated client type: `GroupScopedAvailabilityOrphanedBooking` (windows,
 * Phase 3a) and `GroupScopedBlockOrphanedBooking` (blocks, Phase 4) are
 * structurally identical -- `{ id, calendar_id, title, start_time,
 * end_time }` -- but nominally distinct generated types. Binding this
 * component to either one would force Phase 4 to either duplicate it or
 * cast across the two; a caller on either side passes its own hook result's
 * `orphaned_bookings` array straight through instead (see
 * group-window-grid.tsx's onSubmit, which does exactly that for windows).
 *
 * Orphan detection FREQUENCY differs between windows and blocks (windows:
 * only the calendar's first window in the slot, and narrowing updates;
 * blocks: every create and update) -- this component does not assume
 * either. It only ever renders what its caller collected for one save.
 *
 * No booking-detail route exists in this app (events are opened from an
 * in-page list/dialog in events-view.tsx, never addressable by id via a
 * route or query param -- confirmed by reading that component before
 * writing this one). Linking to a booking would therefore either invent a
 * route that doesn't exist or 404. Each entry is rendered as plain text
 * instead of a link; see the phase report for this decision.
 *
 * Nothing about a listed booking is modified by rendering this alert, and
 * the copy says so explicitly -- this is a heads-up for manual follow-up,
 * never an automatic action.
 */

import * as React from 'react';
import { X } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  HStack,
  Stack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { zonedFormat } from '@/lib/datetime/index';

/**
 * Minimal identification of a booking a group-scoped write orphaned --
 * matches the shape of both `GroupScopedAvailabilityOrphanedBooking` and
 * `GroupScopedBlockOrphanedBooking`. See the module doc comment for why this
 * isn't one of those generated types directly.
 */
export interface OrphanedBooking {
  id: number;
  calendar_id: number;
  title: string;
  start_time: string;
  end_time: string;
}

export interface OrphanedBookingsAlertProps {
  /** One entry per stranded booking. Render nothing when empty. */
  bookings: readonly OrphanedBooking[];
  /** Called when the admin dismisses the alert. */
  onDismiss?: () => void;
}

function OrphanedBookingRow({ booking }: { booking: OrphanedBooking }) {
  // No per-booking timezone in this shape (see the module doc comment) --
  // rendered in UTC, same convention as conflict-surface.tsx's
  // ConflictWindowDetail for the same reason.
  const start = zonedFormat(booking.start_time, 'UTC', 'MMM d, yyyy, h:mm a');
  const end = zonedFormat(booking.end_time, 'UTC', 'h:mm a');

  return (
    <Stack
      gap={0}
      p={2}
      border
      radius='md'
      data-testid={`orphaned-booking-${booking.id}`}
    >
      <Text size='sm' weight='medium'>
        {booking.title}
      </Text>
      <Text size='xs' color='muted-foreground'>
        {start} – {end}
      </Text>
      <Text size='xs' color='muted-foreground'>
        Calendar #{booking.calendar_id}
      </Text>
    </Stack>
  );
}

export function OrphanedBookingsAlert({
  bookings,
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
          <OrphanedBookingRow key={booking.id} booking={booking} />
        ))}
      </Stack>
    </Alert>
  );
}
