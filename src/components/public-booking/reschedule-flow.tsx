'use client';

/**
 * RescheduleFlow — the attendee-facing flow for `/book/[code]/reschedule`
 * (and its branded `/o/[slug]/…` twin).
 *
 * Reuses `usePublicBookableSlots` / `usePublicGroupBookableSlots`,
 * `SlotPicker`, `BookingConfirmation`, and `LinkInvalid` UNCHANGED — this
 * phase does not fork any of them (see the plan's Phase 4 body). The only
 * new pieces are the write (`usePublicReschedule`) and this flow's own,
 * simpler state machine — there is no attendee-details step at all.
 *
 * RULE 1 — NO PROBING: which of the two reschedule endpoints to call is
 * resolved ONCE, from the URL's `?target=` marker
 * (`resolveBookingLinkTarget`, the same function `PublicBookingEntry` uses —
 * written by `buildBookingLinkUrl` at MINT time, see that file's doc
 * comment), and passed straight through to `usePublicReschedule`. This
 * component never calls one endpoint, reads a `403 NOT_PERMITTED`, and
 * retries the other — a group-scoped code's request never even reaches the
 * single-calendar endpoint, and vice versa.
 *
 * RULE 2 — TIMES ONLY: `BookingCodeReschedule` accepts only
 * `start_time` / `end_time` / `timezone` — title, description, attendees,
 * and resource allocations are snapshotted server-side from the existing
 * event and are never client-settable here. This flow renders no field for
 * any of those; the confirm step shows only the newly selected time.
 *
 * RULE 3 — opaque read vs. real write vocabulary: identical split to
 * `public-booking-flow.tsx`. The bookable-slots READ collapses every code
 * failure into the one opaque `<LinkInvalid />`. The reschedule WRITE uses
 * the real `{error_code, detail}` vocabulary via `terminalErrorCopy`
 * (imported, not forked, from `public-booking-flow.tsx`) — so `ALREADY_USED`
 * is worded distinctly from `LinkInvalid`'s generic copy. `SLOT_UNAVAILABLE`
 * is the one write failure that is NOT terminal: the code survives, so a
 * newly-busy time sends the attendee back to slot selection with the list
 * refetched, exactly like the book flow.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Ban, TriangleAlert } from 'lucide-react';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from 'vinta-schedule-design-system/ui/card';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from 'vinta-schedule-design-system/ui/alert';
import { Icon } from 'vinta-schedule-design-system/ui/icon';
import {
  HStack,
  Heading,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import type { BookableSlotProposal, CalendarEvent } from '@/client';
import { DateTime, zonedFormat } from '@/lib/datetime/index';
import { usePublicBookableSlots } from '@/hooks/booking-codes/use-public-bookable-slots';
import { usePublicGroupBookableSlots } from '@/hooks/booking-codes/use-public-group-booking';
import { usePublicReschedule } from '@/hooks/booking-codes/use-public-reschedule';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import { GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS } from '@/lib/booking-links/group-slots-duration-placeholder';
import { resolveBookingLinkTarget } from './public-booking-entry';
import { SlotPicker, proposalDurationMinutes } from './slot-picker';
import { BookingConfirmation } from './booking-confirmation';
import { LinkInvalid } from './link-invalid';
import { terminalErrorCopy } from './public-booking-flow';

/** Matches the book flows' default "next couple weeks" search window. */
const SEARCH_WINDOW_DAYS = 14;

type FlowStep = 'select-slot' | 'confirm-slot' | 'confirmed' | 'terminal-error';

export interface RescheduleFlowProps {
  /** Plaintext booking code from the URL. */
  code: string;
}

export function RescheduleFlow({ code }: RescheduleFlowProps) {
  const searchParams = useSearchParams();
  const target = resolveBookingLinkTarget(searchParams);

  const durationParam = searchParams.get('duration');
  const durationSeconds = durationParam !== null ? Number(durationParam) : NaN;
  // A calendar-scoped reschedule link always carries `?duration=` (advisory,
  // chosen by the minting member from the event's own current length — see
  // `mint-booking-link-dialog.tsx`); a group-scoped link never does, and
  // never needs one. A missing/malformed value on a calendar-scoped link is
  // a broken link, not a code-validity question, so it never routes through
  // `LinkInvalid`.
  const hasValidDuration =
    target === 'group' ||
    (Number.isFinite(durationSeconds) && durationSeconds > 0);

  // Computed once per mount — a sliding search window mid-flow would be a
  // confusing moving target for the attendee.
  const [searchWindow] = React.useState(() => {
    const start = DateTime.now();
    return {
      start: start.toISO() ?? '',
      end: start.plus({ days: SEARCH_WINDOW_DAYS }).toISO() ?? '',
    };
  });

  const [timezone] = React.useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [step, setStep] = React.useState<FlowStep>('select-slot');
  const [selectedSlot, setSelectedSlot] =
    React.useState<BookableSlotProposal | null>(null);
  const [confirmedEvent, setConfirmedEvent] =
    React.useState<CalendarEvent | null>(null);
  const [terminalFailure, setTerminalFailure] =
    React.useState<PublicWriteFailure | null>(null);
  const [slotUnavailableNotice, setSlotUnavailableNotice] =
    React.useState(false);

  // Both read hooks are always called (React hooks rules), but only the one
  // matching `target` is `enabled` — the other never issues a request. This
  // is the read-side half of "no probing": a group-scoped code's slot read
  // never reaches the single-calendar endpoint, and vice versa.
  const calendarSlotsQuery = usePublicBookableSlots({
    code,
    durationSeconds:
      target === 'calendar' && hasValidDuration ? durationSeconds : 0,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
    enabled: target === 'calendar' && hasValidDuration,
  });

  const groupSlotsQuery = usePublicGroupBookableSlots({
    code,
    durationSeconds: GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
    enabled: target === 'group',
  });

  const slotsQuery = target === 'group' ? groupSlotsQuery : calendarSlotsQuery;

  const { reschedule, rescheduleMutation } = usePublicReschedule();

  const handleSelectSlot = (proposal: BookableSlotProposal) => {
    setSlotUnavailableNotice(false);
    setSelectedSlot(proposal);
    setStep('confirm-slot');
  };

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    try {
      const event = await reschedule({
        code,
        target,
        body: {
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          timezone,
        },
      });
      setConfirmedEvent(event);
      setStep('confirmed');
    } catch (err) {
      if (err instanceof PublicWriteFailureError) {
        if (err.failure.isRetryable) {
          // SLOT_UNAVAILABLE — the code was NOT consumed. Send the attendee
          // back to slot selection with a freshly refetched list.
          setSelectedSlot(null);
          setSlotUnavailableNotice(true);
          setStep('select-slot');
          void slotsQuery.refetch();
          return;
        }
        setTerminalFailure(err.failure);
        setStep('terminal-error');
        return;
      }
      setTerminalFailure({
        errorCode: null,
        detail: 'Something went wrong. Please try again in a moment.',
        isRetryable: false,
      });
      setStep('terminal-error');
    }
  };

  if (target === 'calendar' && !hasValidDuration) {
    return (
      <Card data-testid='invalid-duration'>
        <CardHeader>
          <CardTitle>This link is missing a valid duration</CardTitle>
        </CardHeader>
        <CardContent>
          <Text color='muted-foreground'>
            Contact whoever shared this link with you for a new one.
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (slotsQuery.isError) {
    const readError = slotsQuery.error;
    if (
      readError instanceof PublicReadFailureError &&
      readError.state === 'link-invalid'
    ) {
      return <LinkInvalid />;
    }
    return (
      <Card data-testid='reschedule-slots-load-error'>
        <CardHeader>
          <CardTitle>We couldn&apos;t load bookable times</CardTitle>
        </CardHeader>
        <CardContent>
          <VStack gap={3}>
            <Text color='muted-foreground'>
              Something went wrong loading available times. Please try again.
            </Text>
            <Button
              type='button'
              variant='outline'
              onClick={() => void slotsQuery.refetch()}
              data-testid='retry-load-reschedule-slots'
            >
              Try again
            </Button>
          </VStack>
        </CardContent>
      </Card>
    );
  }

  if (step === 'terminal-error' && terminalFailure) {
    const { title, description } = terminalErrorCopy(terminalFailure);
    return (
      <Card data-testid='reschedule-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='reschedule-terminal-error-description'
          >
            {description}
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (step === 'confirmed' && confirmedEvent) {
    return <BookingConfirmation event={confirmedEvent} timezone={timezone} />;
  }

  return (
    <VStack gap={4}>
      <Heading level={1} size='xl'>
        Reschedule your appointment
      </Heading>

      {slotUnavailableNotice ? (
        <Alert
          variant='warning'
          data-testid='reschedule-slot-unavailable-notice'
        >
          <Icon icon={TriangleAlert} size='sm' />
          <AlertTitle>That time was just taken</AlertTitle>
          <AlertDescription>Pick another time below.</AlertDescription>
        </Alert>
      ) : null}

      {step === 'select-slot' ? (
        <SlotPicker
          proposals={slotsQuery.data ?? []}
          timezone={timezone}
          selectedSlot={selectedSlot}
          onSelect={handleSelectSlot}
          isLoading={slotsQuery.isLoading}
        />
      ) : selectedSlot ? (
        <VStack gap={4}>
          <Card data-testid='reschedule-selected-slot-summary'>
            <CardContent>
              <Text weight='medium'>
                {zonedFormat(
                  selectedSlot.start_time,
                  timezone,
                  'MMM d, yyyy, h:mm a'
                )}
              </Text>
              <Text size='sm' color='muted-foreground'>
                {proposalDurationMinutes(selectedSlot)} min
              </Text>
            </CardContent>
          </Card>
          <HStack gap={2} justify='end'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setStep('select-slot')}
              disabled={rescheduleMutation.isPending}
              data-testid='reschedule-back'
            >
              Back
            </Button>
            <Button
              type='button'
              onClick={() => void handleConfirm()}
              disabled={rescheduleMutation.isPending}
              data-testid='reschedule-confirm'
            >
              {rescheduleMutation.isPending
                ? 'Rescheduling…'
                : 'Confirm new time'}
            </Button>
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
}
