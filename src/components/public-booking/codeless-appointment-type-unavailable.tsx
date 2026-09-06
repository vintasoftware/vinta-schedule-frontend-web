'use client';

/**
 * CodelessAppointmentTypeUnavailable — the `403` state for a `public_booking_slug`
 * that resolves to a real appointment type this route just isn't open to: private
 * (`accepts_public_scheduling` is false), or public with no usable duration
 * (`_resolve_public_group_duration` fails closed the same way).
 *
 * DISTINCT from `<CodelessAppointmentTypeNotFound />` on purpose — see
 * `@/lib/booking-links/codeless-appointment-type-read-errors`'s doc comment. Never
 * merge the two; the phase spec that introduced this route requires them to
 * render differently, matching the backend's own distinct 404/403 contract.
 */

import { CalendarX2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text } from 'vinta-schedule-design-system/layout';

export function CodelessAppointmentTypeUnavailable() {
  return (
    <Card data-testid='codeless-appointment-type-unavailable'>
      <CardHeader>
        <HStack gap={2} align='center'>
          <Icon icon={CalendarX2} color='destructive' aria-hidden />
          <CardTitle>This scheduling page isn&apos;t open right now</CardTitle>
        </HStack>
      </CardHeader>
      <CardContent>
        <Text color='muted-foreground'>
          This appointment type isn&apos;t currently accepting public bookings.
          Contact whoever shared this link with you for another way to schedule.
        </Text>
      </CardContent>
    </Card>
  );
}
