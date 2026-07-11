'use client';

/**
 * TriggerRoomsSyncButton — fire-and-toast button for triggering rooms sync.
 *
 * Flow:
 *  1. Admin clicks "Sync rooms" to trigger an asynchronous sync.
 *  2. Button disables on click; mutation fires.
 *  3. On success: toast "Sync started"; button re-enables after debounce.
 *  4. On error: toast with error message; button re-enables.
 *  5. Debounce prevents double-fire within a short window.
 *
 * The button uses the triggerRoomsSync hook (Phase 34) which wraps the
 * organizationsSyncRoomsCreate endpoint.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { useTriggerRoomsSync } from '@/hooks/sync/use-trigger-rooms-sync';

const DEBOUNCE_MS = 500;

export function TriggerRoomsSyncButton() {
  const { triggerRoomsSync, triggerSyncMutation } = useTriggerRoomsSync();
  const [isDebouncing, setIsDebouncing] = React.useState(false);

  const handleClick = async () => {
    if (isDebouncing) return;

    setIsDebouncing(true);

    try {
      await triggerRoomsSync();
      toast.success('Sync started');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start sync';
      toast.error(message);
    } finally {
      // Debounce: wait before allowing next click
      setTimeout(() => {
        setIsDebouncing(false);
      }, DEBOUNCE_MS);
    }
  };

  const isPending = triggerSyncMutation.isPending || isDebouncing;

  return (
    <Button
      type='button'
      onClick={handleClick}
      disabled={isPending}
      variant='default'
    >
      {isPending ? 'Syncing...' : 'Sync rooms'}
    </Button>
  );
}
