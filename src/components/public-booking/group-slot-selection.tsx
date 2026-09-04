'use client';

/**
 * GroupSlotSelection — per-slot calendar selection for a public group
 * booking link, once the attendee has picked a whole-group time proposal.
 *
 * Reuses the exact `SlotViewModel` shape and the pure `isSelectionComplete`
 * / `hasUnsatisfiableSlot` helpers from `@/lib/booking-links/group-selection`
 * (moved there in this phase specifically so this public surface could use
 * them without dragging the authenticated group-booking hook's imports into
 * the public bundle — see that module's doc comment). Only free candidates
 * (`slot.availableCalendarIds`) are selectable; a candidate present in
 * `slot.pool` but absent from `availableCalendarIds` renders disabled as
 * "busy", mirroring the authenticated group-booking dialog's per-slot picker
 * (`@/components/calendar-groups/group-booking-flow.tsx`).
 *
 * PRIVACY: this surface is unauthenticated. The public
 * `calendar-group-availability` read returns ONLY numeric calendar ids per
 * slot — no calendar name, no owner. `slot.pool` here is therefore always
 * built by the caller as exactly the free-id set relabeled "Option N"
 * (never a real calendar name) — there is nothing richer to show, and this
 * component must never be fed real calendar/owner names.
 */

import * as React from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Checkbox } from 'vinta-schedule-design-system/ui/checkbox';
import { Label } from 'vinta-schedule-design-system/ui/label';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';
import type { CalendarGroupSlotSelectionInput } from '@/client';
import {
  isSelectionComplete,
  hasUnsatisfiableSlot,
  type SlotViewModel,
} from '@/lib/booking-links/group-selection';

export interface GroupSlotSelectionProps {
  slots: SlotViewModel[];
  /** Draft selection, keyed by slot id. */
  selection: Record<number, number[]>;
  onToggle: (slotId: number, calendarId: number) => void;
  /** Called with a complete, valid `slot_selections` payload. */
  onSubmit: (slotSelections: CalendarGroupSlotSelectionInput[]) => void;
  isSubmitting?: boolean;
  /** Return to time-proposal selection — omitted hides the button. */
  onBack?: () => void;
}

export function GroupSlotSelection({
  slots,
  selection,
  onToggle,
  onSubmit,
  isSubmitting = false,
  onBack,
}: GroupSlotSelectionProps) {
  const unsatisfiable = hasUnsatisfiableSlot(slots);
  const complete = isSelectionComplete(slots, selection);
  const canSubmit = complete && !unsatisfiable && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const slotSelections: CalendarGroupSlotSelectionInput[] = slots.map(
      (slot) => ({
        slot_id: slot.slotId,
        calendar_ids: selection[slot.slotId] ?? [],
      })
    );
    onSubmit(slotSelections);
  };

  return (
    <VStack gap={4} data-testid='group-slot-selection'>
      {unsatisfiable ? (
        <Alert variant='warning' data-testid='group-slot-unsatisfiable-alert'>
          <Icon icon={TriangleAlert} size='sm' />
          <AlertTitle>This time can&apos;t be fully booked</AlertTitle>
          <AlertDescription>
            One or more slots don&apos;t have enough free options at this time.
            Go back and pick another time.
          </AlertDescription>
        </Alert>
      ) : null}

      {slots.map((slot) => {
        const free = slot.availableCalendarIds ?? [];
        const slotSatisfiable = free.length >= slot.requiredCount;
        const selected = selection[slot.slotId] ?? [];

        return (
          <VStack
            key={slot.slotId}
            gap={2}
            p={3}
            border
            radius='md'
            data-testid={`group-slot-${slot.slotId}`}
          >
            <HStack gap={2} align='center' justify='between'>
              <Text size='sm' weight='medium'>
                {slot.name}
              </Text>
              <Text
                size='xs'
                color={slotSatisfiable ? 'muted-foreground' : 'destructive'}
              >
                Pick {slot.requiredCount} of {free.length} available · selected{' '}
                {selected.length}
              </Text>
            </HStack>

            {!slotSatisfiable ? (
              <Text
                size='xs'
                color='destructive'
                data-testid={`group-slot-${slot.slotId}-unsatisfiable`}
              >
                Not enough available options for this slot at this time.
              </Text>
            ) : null}

            <VStack gap={2}>
              {slot.pool.map((candidate, index) => {
                const isFree = free.includes(candidate.id);
                const isChecked = selected.includes(candidate.id);
                const inputId = `group-slot-${slot.slotId}-option-${candidate.id}`;
                return (
                  <HStack key={candidate.id} gap={2} align='center'>
                    <Checkbox
                      id={inputId}
                      checked={isChecked}
                      disabled={!isFree}
                      onCheckedChange={() =>
                        onToggle(slot.slotId, candidate.id)
                      }
                      aria-label={`Option ${index + 1}${isFree ? '' : ' (unavailable)'}`}
                      data-testid={inputId}
                    />
                    <Label
                      htmlFor={inputId}
                      className={
                        isFree ? 'cursor-pointer' : 'text-muted-foreground'
                      }
                    >
                      Option {index + 1}
                      {!isFree ? ' · unavailable' : ''}
                    </Label>
                  </HStack>
                );
              })}
            </VStack>
          </VStack>
        );
      })}

      <HStack gap={2} justify='end'>
        {onBack ? (
          <Button
            type='button'
            variant='outline'
            onClick={onBack}
            disabled={isSubmitting}
            data-testid='group-slot-selection-back'
          >
            Back
          </Button>
        ) : null}
        <Button
          type='button'
          onClick={handleSubmit}
          disabled={!canSubmit}
          data-testid='group-slot-selection-continue'
        >
          {isSubmitting ? 'Continuing…' : 'Continue'}
        </Button>
      </HStack>
    </VStack>
  );
}
