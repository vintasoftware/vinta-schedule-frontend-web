'use client';

/**
 * OverLimitAlert — surfaces a `readOverLimitError` (402) rejection from a
 * group-scoped write (spec UC-6): which resource is metered, current usage,
 * and the plan limit, straight from the typed body (`@/lib/utils/api-errors`).
 *
 * Deliberately no upgrade link -- the app has no billing surface to send an
 * admin to (Non-goals, CALENDAR_GROUP_SCOPED_AVAILABILITY plan). Inventing
 * one would either 404 or point at nothing.
 *
 * `otherWritesSucceeded` exists because the caller's save is diff-based and
 * batches several writes with `Promise.allSettled` (group-window-grid.tsx):
 * an over-limit rejection on ONE write does not mean the whole save did
 * nothing -- earlier creates/updates/deletes in the same batch may already
 * have reached the server before this one was rejected. Wording the alert
 * as though nothing was written would be false whenever that happens; this
 * prop lets the copy say what's actually true. Pass 0 (the default) when
 * this was the only write attempted, or when nothing else in the batch
 * succeeded.
 */

import { AlertCircle } from 'lucide-react';

import {
  Alert,
  AlertTitle,
  AlertDescription,
} from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import type { OverLimitErrorBody } from '@/lib/utils/api-errors';

// Friendlier labels for the resource names the backend sends -- falls back
// to a humanized version of the raw slug for anything not listed here, so
// an unmapped resource still renders sensibly rather than being dropped.
const RESOURCE_LABELS: Record<string, string> = {
  availability_windows: 'availability windows',
};

function resourceLabel(resource: string): string {
  return RESOURCE_LABELS[resource] ?? resource.replace(/_/g, ' ');
}

export interface OverLimitAlertProps {
  error: OverLimitErrorBody;
  /** See the module doc comment. Defaults to 0. */
  otherWritesSucceeded?: number;
}

export function OverLimitAlert({
  error,
  otherWritesSucceeded = 0,
}: OverLimitAlertProps) {
  const label = resourceLabel(error.resource);

  return (
    <Alert variant='destructive' data-testid='over-limit-alert'>
      <Icon icon={AlertCircle} />
      <AlertTitle>Plan limit reached</AlertTitle>
      <AlertDescription>
        Your organization is at its plan limit for {label}:{' '}
        {error.current_usage} of {error.limit} used. This change was not saved.{' '}
        {otherWritesSucceeded > 0
          ? `${otherWritesSucceeded} other change${otherWritesSucceeded === 1 ? '' : 's'} in this save already went through and ${otherWritesSucceeded === 1 ? 'was' : 'were'} kept.`
          : 'Nothing else in this save was applied.'}
      </AlertDescription>
    </Alert>
  );
}
