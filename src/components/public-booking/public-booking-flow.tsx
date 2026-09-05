'use client';

/**
 * PublicBookingFlow — the single-calendar public booking flow (Phase 2).
 *
 * Orchestrates: read bookable slots → pick one → collect attendee details →
 * write the booking → show a terminal state (confirmed, or a distinct
 * failure). Branding chrome lives one level up in `PublicBookingShell`,
 * mounted by the page — this component is deliberately branding-agnostic so
 * it stays a pure booking-flow concern.
 *
 * ERROR HANDLING — the three rules this phase is most likely to get wrong:
 *
 * 1. The rendered slot length ALWAYS comes from `slot-picker.tsx`'s
 *    `proposalDurationMinutes`, reading each proposal's own `start_time`/
 *    `end_time` — never from the `?duration=` query param. A pinned
 *    duration overrides the request silently (no error), so echoing the
 *    requested value back would misreport it. `?duration=` is used ONLY to
 *    build the read request.
 * 2. Every code-gated read failure — invalid, expired, used, revoked,
 *    wrong-scope — surfaces as `PublicReadFailureError('link-invalid')` and
 *    renders the ONE undifferentiated `<LinkInvalid />`. Never branch this
 *    into "expired" / "already used" copy — the backend's 403 doesn't say
 *    which, and guessing would leak state it deliberately hides.
 * 3. Writes carry a real vocabulary. `SLOT_UNAVAILABLE` does NOT consume the
 *    code, so it returns the attendee to slot selection with the slot list
 *    refetched (`slotsQuery.refetch()`). Every other `error_code` is
 *    terminal, and `terminalErrorCopy` gives `ALREADY_USED` and `EXPIRED`
 *    (and the rest) distinct, non-generic copy.
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
import type {
  BookableSlotProposal,
  CalendarEventWithManagementCodes,
} from '@/client';
import { DateTime, zonedFormat } from '@/lib/datetime/index';
import { usePublicBookableSlots } from '@/hooks/booking-codes/use-public-bookable-slots';
import { usePublicBookEvent } from '@/hooks/booking-codes/use-public-book-event';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import { SlotPicker, proposalDurationMinutes } from './slot-picker';
import { AttendeeForm, type AttendeeFormValues } from './attendee-form';
import { BookingConfirmation } from './booking-confirmation';
import { LinkInvalid } from './link-invalid';

/**
 * How far ahead the slot search window looks. Not specified by the plan.
 * The picker now shows a month calendar (`slot-picker.tsx`) rather than a
 * flat list, so a two-week window that can only ever light up half of a
 * displayed month reads as broken — 30 days gives the grid roughly a full
 * month's worth of bookable days, matching what an attendee expects to see
 * when they land on a month view.
 */
const SEARCH_WINDOW_DAYS = 30;

/**
 * `BookingCodeEventCreate.title` is required by the API, but nothing in this
 * flow asks an anonymous attendee to title their own appointment — the
 * purpose is already implicit in whichever calendar the link points at.
 * A fixed constant keeps `attendee-form.tsx` scoped to exactly the fields
 * `_BookingCodeExternalAttendee` needs (email required, name optional).
 */
const DEFAULT_PUBLIC_BOOKING_TITLE = 'Appointment';

type FlowStep =
  | 'select-slot'
  | 'attendee-details'
  | 'confirmed'
  | 'terminal-error';

export interface PublicBookingFlowProps {
  /** Plaintext booking code from the URL. */
  code: string;
  /**
   * Active organization slug, when known — threaded down from the branded
   * `/o/[slug]/book/[code]` page (which knows it from its own route params)
   * so `BookingConfirmation` can build branded self-service links. The bare
   * `/book/[code]` route has no way to resolve one, so this stays
   * `undefined` there.
   */
  slug?: string;
}

/**
 * Distinct copy per write `error_code`. `ALREADY_USED` and `EXPIRED` must
 * never share wording — the plan calls this out as an explicit acceptance
 * criterion, since a write failure (unlike a read failure) DOES disclose a
 * real reason and hiding it would just be a worse user experience for no
 * security benefit.
 */
export function terminalErrorCopy(failure: PublicWriteFailure): {
  title: string;
  description: string;
} {
  switch (failure.errorCode) {
    case 'ALREADY_USED':
      return {
        title: 'This link has already been used',
        description:
          'A booking was already made with this link. Contact whoever shared it with you if you need another appointment.',
      };
    case 'EXPIRED':
      return {
        title: 'This link has expired',
        description:
          'This scheduling link is no longer valid. Contact whoever shared it with you for a new one.',
      };
    case 'REVOKED':
      return {
        title: 'This link has been revoked',
        description:
          'This scheduling link no longer works. Contact whoever shared it with you for a new one.',
      };
    case 'NOT_PERMITTED':
    case 'INVALID_CODE':
      return {
        title: "This link can't be used",
        description:
          'This scheduling link is not valid. Contact whoever shared it with you for a new one.',
      };
    default:
      return {
        title: 'Something went wrong',
        description: failure.detail || 'Please try again in a moment.',
      };
  }
}

export function PublicBookingFlow({ code, slug }: PublicBookingFlowProps) {
  const searchParams = useSearchParams();
  const durationParam = searchParams.get('duration');
  const durationSeconds = durationParam !== null ? Number(durationParam) : NaN;
  // A calendar `book` link always carries `?duration=` (chosen by the
  // minting member — see the plan's "Single-calendar duration is advisory"
  // guiding decision); a missing/malformed value is a broken link, not a
  // code-validity question, so it never routes through `LinkInvalid`.
  const hasValidDuration =
    Number.isFinite(durationSeconds) && durationSeconds > 0;

  // Computed once per mount — the search window sliding under the attendee
  // while they're mid-flow would be a confusing moving target.
  const [searchWindow] = React.useState(() => {
    const start = DateTime.now();
    return {
      start: start.toISO() ?? '',
      end: start.plus({ days: SEARCH_WINDOW_DAYS }).toISO() ?? '',
    };
  });

  const [timezone, setTimezone] = React.useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [step, setStep] = React.useState<FlowStep>('select-slot');
  const [selectedSlot, setSelectedSlot] =
    React.useState<BookableSlotProposal | null>(null);
  const [confirmedEvent, setConfirmedEvent] =
    React.useState<CalendarEventWithManagementCodes | null>(null);
  const [terminalFailure, setTerminalFailure] =
    React.useState<PublicWriteFailure | null>(null);
  const [slotUnavailableNotice, setSlotUnavailableNotice] =
    React.useState(false);

  const slotsQuery = usePublicBookableSlots({
    code,
    durationSeconds: hasValidDuration ? durationSeconds : 0,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
    enabled: hasValidDuration,
  });

  const { bookEvent, bookEventMutation } = usePublicBookEvent();

  // Belt-and-suspenders alongside `usePublicBookEvent`'s `gcTime: 0`: on
  // unmount (navigating away from this confirmed booking), explicitly clear
  // the mutation's cached response — which carries the plaintext
  // self-service codes — rather than relying solely on the deferred
  // 0ms-timer collection `gcTime: 0` schedules. Mirrors
  // `mint-booking-link-dialog.tsx`'s identical unmount cleanup.
  const resetBookEventMutation = bookEventMutation.reset;
  React.useEffect(() => resetBookEventMutation, [resetBookEventMutation]);

  const handleSelectSlot = (proposal: BookableSlotProposal) => {
    setSlotUnavailableNotice(false);
    setSelectedSlot(proposal);
    setStep('attendee-details');
  };

  const handleAttendeeSubmit = async (values: AttendeeFormValues) => {
    if (!selectedSlot) return;
    try {
      const event = await bookEvent({
        code,
        body: {
          title: DEFAULT_PUBLIC_BOOKING_TITLE,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          timezone: values.timezone,
          external_attendee: values.name
            ? { email: values.email, name: values.name }
            : { email: values.email },
        },
      });
      setTimezone(values.timezone);
      setConfirmedEvent(event);
      setStep('confirmed');
    } catch (err) {
      if (err instanceof PublicWriteFailureError) {
        if (err.failure.isRetryable) {
          // SLOT_UNAVAILABLE — the code was NOT consumed (see the module
          // doc comment, rule 3). Send the attendee back to slot selection
          // with a freshly refetched list rather than a dead end.
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
      // Unrecognized failure shape (network error, unexpected response) —
      // surface generically rather than leaving the attendee stuck on a
      // spinner with no explanation.
      setTerminalFailure({
        errorCode: null,
        detail: 'Something went wrong. Please try again in a moment.',
        isRetryable: false,
      });
      setStep('terminal-error');
    }
  };

  if (!hasValidDuration) {
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
      <Card data-testid='slots-load-error'>
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
              data-testid='retry-load-slots'
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
      <Card data-testid='booking-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='booking-terminal-error-description'
          >
            {description}
          </Text>
        </CardContent>
      </Card>
    );
  }

  if (step === 'confirmed' && confirmedEvent) {
    return (
      <BookingConfirmation
        event={confirmedEvent}
        timezone={timezone}
        scope={{ kind: 'calendar' }}
        slug={slug}
      />
    );
  }

  return (
    <VStack gap={4}>
      <Heading level={1} size='xl'>
        Book an appointment
      </Heading>

      {slotUnavailableNotice ? (
        <Alert variant='warning' data-testid='slot-unavailable-notice'>
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
      ) : (
        <VStack gap={4}>
          {selectedSlot ? (
            <Card data-testid='selected-slot-summary'>
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
          ) : null}
          <AttendeeForm
            defaultTimezone={timezone}
            isSubmitting={bookEventMutation.isPending}
            onSubmit={handleAttendeeSubmit}
            onBack={() => setStep('select-slot')}
          />
        </VStack>
      )}
    </VStack>
  );
}
