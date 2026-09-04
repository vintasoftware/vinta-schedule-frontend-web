'use client';

/**
 * BookingConfirmation — terminal success state after a public booking write.
 *
 * Renders the SERVER's `CalendarEvent` response, never the attendee's
 * originally-selected proposal — the same "trust the response, not local
 * state" discipline as `slot-picker.tsx`'s duration rule, applied to the
 * confirmation screen.
 */

import { CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import type { CalendarEvent } from '@/client';
import { zonedFormat } from '@/lib/datetime/index';

export interface BookingConfirmationProps {
  event: CalendarEvent;
  /** IANA zone to render the confirmed time in — the attendee's chosen zone. */
  timezone: string;
}

export function BookingConfirmation({
  event,
  timezone,
}: BookingConfirmationProps) {
  return (
    <Card data-testid='booking-confirmation'>
      <CardHeader>
        <HStack gap={2} align='center'>
          <Icon icon={CheckCircle2} color='success' aria-hidden />
          <CardTitle>Booking confirmed</CardTitle>
        </HStack>
      </CardHeader>
      <CardContent>
        <VStack gap={2}>
          <Text weight='medium'>{event.title}</Text>
          <Text
            size='sm'
            color='muted-foreground'
            data-testid='confirmation-time'
          >
            {zonedFormat(event.start_time, timezone, 'MMM d, yyyy, h:mm a')} –{' '}
            {zonedFormat(event.end_time, timezone, 'h:mm a ZZZZ')}
          </Text>
          <Text size='sm' color='muted-foreground'>
            Save this confirmation for your records.
          </Text>
        </VStack>
      </CardContent>
    </Card>
  );
}
