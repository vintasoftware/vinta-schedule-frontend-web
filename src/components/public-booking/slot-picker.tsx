'use client';

/**
 * SlotPicker — renders `BookableSlotProposal[]` as a single-select list and
 * reports the chosen proposal back to the caller.
 *
 * LOAD-BEARING: `proposalDurationMinutes` derives the displayed length from
 * the proposal's OWN `start_time`/`end_time`, never from a duration the
 * caller requested. A group-scoped code's pinned duration silently overrides
 * the request with no error (see the plan's "Read the duration off the
 * proposals, never off local state" guiding decision) — a picker that
 * echoed the requested duration back would misreport every pinned proposal.
 * This is the one function the flow-level regression test
 * (`public-booking-flow.test.tsx`) exercises directly.
 */

import {
  RadioGroup,
  RadioGroupItem,
} from 'vinta-schedule-design-system/ui/radio-group';
import { Label } from 'vinta-schedule-design-system/ui/label';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { HStack, Text, VStack } from 'vinta-schedule-design-system/layout';
import type { BookableSlotProposal } from '@/client';
import { DateTime, zonedFormat } from '@/lib/datetime/index';

/** Stable identity for a proposal — the API returns no id, only the range. */
export function proposalKey(proposal: BookableSlotProposal): string {
  return `${proposal.start_time}__${proposal.end_time}`;
}

/**
 * Minutes between a proposal's own `start_time`/`end_time`. See the module
 * doc comment — this must never read a requested/local duration instead.
 * Returns 0 for an unparsable range rather than throwing (a picker still
 * renders the time even if the duration line is degraded).
 */
export function proposalDurationMinutes(
  proposal: BookableSlotProposal
): number {
  const start = DateTime.fromISO(proposal.start_time);
  const end = DateTime.fromISO(proposal.end_time);
  if (!start.isValid || !end.isValid) return 0;
  const minutes = end.diff(start, 'minutes').minutes;
  return minutes > 0 ? Math.round(minutes) : 0;
}

export interface SlotPickerProps {
  proposals: BookableSlotProposal[];
  /** IANA zone the proposal times are rendered in. */
  timezone: string;
  selectedSlot: BookableSlotProposal | null;
  onSelect: (proposal: BookableSlotProposal) => void;
  isLoading?: boolean;
}

export function SlotPicker({
  proposals,
  timezone,
  selectedSlot,
  onSelect,
  isLoading = false,
}: SlotPickerProps) {
  if (isLoading) {
    return (
      <VStack gap={2} data-testid='slot-picker-loading'>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className='h-14 w-full' />
        ))}
      </VStack>
    );
  }

  if (proposals.length === 0) {
    return (
      <Text size='sm' color='muted-foreground' data-testid='slot-picker-empty'>
        No bookable times are available in this window.
      </Text>
    );
  }

  const selectedKey = selectedSlot ? proposalKey(selectedSlot) : undefined;

  return (
    <RadioGroup
      value={selectedKey}
      onValueChange={(key) => {
        const match = proposals.find(
          (proposal) => proposalKey(proposal) === key
        );
        if (match) onSelect(match);
      }}
      data-testid='slot-picker'
    >
      {proposals.map((proposal) => {
        const key = proposalKey(proposal);
        const minutes = proposalDurationMinutes(proposal);
        return (
          <HStack
            key={key}
            gap={3}
            p={3}
            border
            radius='md'
            align='center'
            data-testid={`slot-option-${key}`}
          >
            <RadioGroupItem
              value={key}
              id={`slot-${key}`}
              aria-label={`Book ${zonedFormat(proposal.start_time, timezone)}`}
            />
            <Label
              htmlFor={`slot-${key}`}
              className='flex flex-1 cursor-pointer flex-col'
            >
              <Text weight='medium'>
                {zonedFormat(
                  proposal.start_time,
                  timezone,
                  'MMM d, yyyy, h:mm a'
                )}
              </Text>
              <Text size='sm' color='muted-foreground'>
                {minutes} min
              </Text>
            </Label>
          </HStack>
        );
      })}
    </RadioGroup>
  );
}
