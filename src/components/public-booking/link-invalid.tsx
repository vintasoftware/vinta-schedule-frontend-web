'use client';

/**
 * LinkInvalid — the ONE undifferentiated state for every code-gated read
 * failure (invalid, expired, used, revoked, wrong-scope).
 *
 * Deliberately takes no props describing WHY the link failed — the backend
 * answers every failure with the same opaque `403` specifically so this
 * page can't disclose which one occurred (see the plan's "The opaque 403 is
 * not an auth failure" guiding decision, and `parseReadFailure` in
 * `@/lib/booking-links/errors.ts`). Never add a prop here that would let a
 * caller pass through a more specific reason — that would defeat the whole
 * point of the backend's uniform 403.
 */

import { Ban } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text } from 'vinta-schedule-design-system/layout';

export function LinkInvalid() {
  return (
    <Card data-testid='link-invalid'>
      <CardHeader>
        <HStack gap={2} align='center'>
          <Icon icon={Ban} color='destructive' aria-hidden />
          <CardTitle>This link is no longer valid</CardTitle>
        </HStack>
      </CardHeader>
      <CardContent>
        <Text color='muted-foreground'>
          This scheduling link can&apos;t be used right now. Contact whoever
          shared it with you to request a new one.
        </Text>
      </CardContent>
    </Card>
  );
}
