'use client';

/**
 * TriggerOrgCalendarSyncButton — fire-and-toast button for triggering a sync
 * of all organization calendars.
 *
 * Flow:
 *  1. Admin clicks "Sync all calendars" to trigger an asynchronous org-wide sync.
 *  2. Button disables on click; mutation fires.
 *  3. On success: toast "Calendar sync started"; button re-enables after debounce.
 *  4. On error: toast with error message; button re-enables.
 *  5. Debounce prevents double-fire within a short window.
 *
 * Mirrors trigger-rooms-sync-button.tsx (Phase 34 pattern).
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { useTriggerOrgCalendarSync } from '@/hooks/sync/use-trigger-org-calendar-sync';

const DEBOUNCE_MS = 500;

export function TriggerOrgCalendarSyncButton() {
  const { triggerOrgCalendarSync, isPending: isSyncing } =
    useTriggerOrgCalendarSync();
  const [isDebouncing, setIsDebouncing] = React.useState(false);

  const handleClick = async () => {
    if (isDebouncing) return;

    setIsDebouncing(true);

    try {
      await triggerOrgCalendarSync();
      toast.success('Calendar sync started');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to start calendar sync';
      toast.error(message);
    } finally {
      // Debounce: wait before allowing next click
      setTimeout(() => {
        setIsDebouncing(false);
      }, DEBOUNCE_MS);
    }
  };

  const isPending = isSyncing || isDebouncing;

  return (
    <Button
      type='button'
      onClick={handleClick}
      disabled={isPending}
      variant='default'
    >
      {isPending ? 'Syncing...' : 'Sync all calendars'}
    </Button>
  );
}
