'use client';

/**
 * CodelessAppointmentTypeNotFound — the `404` state for an unknown `public_booking_slug`.
 *
 * DISTINCT from `<CodelessAppointmentTypeUnavailable />` on purpose — see
 * `@/lib/booking-links/codeless-appointment-type-read-errors`'s doc comment. An unknown
 * slug is the caller's own path input, not a secret, so telling them plainly
 * that no such link exists discloses nothing they didn't already risk by
 * guessing/mistyping one. Never merge this with the "exists but not
 * bookable" state below — that would throw away a distinction the backend
 * deliberately exposes.
 */

import { SearchX } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text } from 'vinta-schedule-design-system/layout';

export function CodelessAppointmentTypeNotFound() {
  return (
    <Card data-testid='codeless-appointment-type-not-found'>
      <CardHeader>
        <HStack gap={2} align='center'>
          <Icon icon={SearchX} color='destructive' aria-hidden />
          <CardTitle>We couldn&apos;t find that scheduling link</CardTitle>
        </HStack>
      </CardHeader>
      <CardContent>
        <Text color='muted-foreground'>
          This link doesn&apos;t match any scheduling page. Double-check the
          address, or ask whoever shared it with you for the right one.
        </Text>
      </CardContent>
    </Card>
  );
}
