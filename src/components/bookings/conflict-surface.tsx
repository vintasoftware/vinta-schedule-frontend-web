'use client';

/**
 * ConflictSurface — shared warn-but-allow-override component.
 *
 * Surfaces per-calendar conflicts (from useAvailabilityCheck) with:
 *  - Which calendar has a conflict
 *  - The reason (from the unavailable window's reason_description)
 *  - The nearest free window (if known)
 *  - Two actions: "Adjust time" (dismiss/cancel) and "Book anyway" (override/proceed)
 *
 * Design decisions (reusable by phases 17/18/21):
 *  - Props are a list of CalendarConflict (per-calendar); the component iterates them.
 *  - onProceed fires when the user clicks "Book anyway" — the caller decides what happens.
 *  - onAdjust fires when the user clicks "Adjust time" — typically restores the form.
 *  - No hard-block: "Book anyway" is always available when conflicts exist.
 *  - Does NOT overwrite conflicting events — that is the backend's job on the
 *    override path; the UI just proceeds with the same create call.
 *
 * Reuse guide (phases 17/18/21):
 *  - Pass conflicts from the per-phase availability check.
 *  - Wire onProceed → the override-submit flow.
 *  - Wire onAdjust → dismiss or close the conflict panel.
 */

import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@vinta-schedule/design-system/ui/alert';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { VStack, HStack, Text } from '@vinta-schedule/design-system/layout';
import type { AvailableTimeWindow, UnavailableTimeWindow } from '@/client';
import { zonedFormat } from '@/lib/datetime/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single per-calendar conflict entry.
 * Passed as a list to ConflictSurface — one entry per conflicting calendar.
 */
export interface CalendarConflict {
  /** The calendar id that has the conflict. */
  calendarId: number;
  /** Human-readable calendar name (for display). */
  calendarName: string;
  /** The unavailable windows overlapping the proposed range. */
  conflictingWindows: UnavailableTimeWindow[];
  /**
   * The nearest available window after the conflict.
   * Null when the availability check returned none.
   */
  nearestFreeWindow: AvailableTimeWindow | null;
}

export interface ConflictSurfaceProps {
  /** Per-calendar conflicts to surface. Must be non-empty. */
  conflicts: CalendarConflict[];
  /**
   * Callback when the user chooses to proceed despite conflicts.
   * The parent should then call the create-booking flow.
   */
  onProceed: () => void;
  /**
   * Callback when the user chooses to adjust the time instead.
   * Typically dismisses this panel and returns focus to the form.
   */
  onAdjust: () => void;
  /** Disable buttons while a submission is in flight. */
  isPending?: boolean;
}

// ---------------------------------------------------------------------------
// ConflictSurface
// ---------------------------------------------------------------------------

export function ConflictSurface({
  conflicts,
  onProceed,
  onAdjust,
  isPending = false,
}: ConflictSurfaceProps) {
  return (
    <VStack gap={4} data-testid='conflict-surface'>
      <Alert className='border-warning bg-background'>
        <TriangleAlert className='text-warning h-4 w-4' />
        <AlertTitle>Scheduling conflict detected</AlertTitle>
        <AlertDescription>
          The selected time overlaps with existing blocks on the following
          calendars. You can still book anyway or adjust the time.
        </AlertDescription>
      </Alert>

      {conflicts.map((conflict) => (
        <ConflictItem key={conflict.calendarId} conflict={conflict} />
      ))}

      <HStack gap={3} justify='end'>
        <Button
          type='button'
          variant='outline'
          onClick={onAdjust}
          disabled={isPending}
        >
          Adjust time
        </Button>
        <Button
          type='button'
          onClick={onProceed}
          disabled={isPending}
          data-testid='book-anyway-btn'
        >
          {isPending ? 'Booking…' : 'Book anyway'}
        </Button>
      </HStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// ConflictItem — per-calendar conflict detail
// ---------------------------------------------------------------------------

function ConflictItem({ conflict }: { conflict: CalendarConflict }) {
  const { calendarName, conflictingWindows, nearestFreeWindow } = conflict;

  return (
    <VStack gap={2} p={3} border radius='md' data-testid='conflict-item'>
      <Text size='sm' className='font-medium'>
        {calendarName}
      </Text>

      {conflictingWindows.map((w) => (
        <ConflictWindowDetail key={w.id} window={w} />
      ))}

      {nearestFreeWindow && <NearestFreeWindow window={nearestFreeWindow} />}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// ConflictWindowDetail — a single unavailable window
// ---------------------------------------------------------------------------

function ConflictWindowDetail({
  window: w,
}: {
  window: UnavailableTimeWindow;
}) {
  const start = zonedFormat(w.start_time, 'UTC', 'MMM d, h:mm a');
  const end = zonedFormat(w.end_time, 'UTC', 'h:mm a');
  const reason = w.reason_description || w.reason;

  return (
    <Text size='sm' color='muted-foreground' data-testid='conflict-window'>
      Busy: {start} – {end}
      {reason ? ` · ${reason}` : ''}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// NearestFreeWindow — the nearest available slot hint
// ---------------------------------------------------------------------------

function NearestFreeWindow({ window: w }: { window: AvailableTimeWindow }) {
  const start = zonedFormat(w.start_time, 'UTC', 'MMM d, h:mm a');
  const end = zonedFormat(w.end_time, 'UTC', 'h:mm a');

  return (
    <Text size='sm' color='muted-foreground' data-testid='nearest-free-window'>
      Nearest free slot: {start} – {end}
    </Text>
  );
}
