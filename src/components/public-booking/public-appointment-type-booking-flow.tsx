'use client';

/**
 * PublicAppointmentTypeBookingFlow — the appointment-type-scoped public booking flow (Phase 3),
 * the appointment type analogue of `public-booking-flow.tsx`.
 *
 * Orchestrates: read whole-appointment-type time proposals → pick one → read per-slot
 * availability for that specific range → pick a calendar for each slot
 * (`AppointmentTypeSlotSelection`) → collect attendee details → write the booking →
 * terminal state. Branding chrome lives one level up in
 * `PublicBookingShell`.
 *
 * ERROR / DATA-TRUST RULES (mirroring `public-booking-flow.tsx`'s three):
 *
 * 1. `AppointmentType.duration` is server-pinned, and an appointment-type-scoped booking
 *    link carries no `?duration=` at all (see the plan's "Appointment Type duration
 *    comes from the server" guiding decision — `build-url.ts` makes a
 *    client-chosen duration for an appointment type link unrepresentable, not just
 *    discouraged). `APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS` (shared
 *    from `@/lib/booking-links/appointment-type-slots-duration-placeholder`) exists
 *    ONLY to satisfy the bookable-slots read's required
 *    `duration_seconds` param; when the appointment type pins a duration (the normal
 *    case for any appointment type a link was minted for) it's silently overridden and
 *    never reaches the UI. The rendered length always comes from the
 *    selected `BookableSlotProposal`'s own span, via
 *    `slot-picker.tsx`'s `proposalDurationMinutes` — never this constant.
 * 2. Every code-gated read failure (initial proposals OR the per-range
 *    availability check) surfaces as `PublicReadFailureError('link-invalid')`
 *    and renders the ONE undifferentiated `<LinkInvalid />` — same rule,
 *    same reasoning as the single-calendar flow.
 * 3. The write's `SLOT_UNAVAILABLE` does NOT consume the code, so it returns
 *    the attendee all the way to whole-appointment-type time selection (not just the
 *    per-slot step) with the proposal list refetched — a slot going busy
 *    between availability-check and submit most plausibly means the chosen
 *    time itself is no longer good. Every other `error_code` is terminal,
 *    reusing `terminalErrorCopy` from `public-booking-flow.tsx` so
 *    `ALREADY_USED` / `EXPIRED` render the same distinct copy on both flows.
 */

import * as React from 'react';
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
  AppointmentTypeSlotAvailability,
  AppointmentTypeSlotSelectionInput,
} from '@/client';
import { DateTime } from '@/lib/datetime/index';
import {
  usePublicAppointmentTypeBookableSlots,
  fetchPublicAppointmentTypeSlotAvailability,
  usePublicAppointmentTypeBookEvent,
} from '@/hooks/booking-codes/use-public-appointment-type-booking';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import type { SlotViewModel } from '@/lib/booking-links/appointment-type-selection';
import { APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS } from '@/lib/booking-links/appointment-type-slots-duration-placeholder';
import { SlotPicker, proposalDurationMinutes } from './slot-picker';
import { AttendeeForm, type AttendeeFormValues } from './attendee-form';
import { BookingConfirmation } from './booking-confirmation';
import { LinkInvalid } from './link-invalid';
import { AppointmentTypeSlotSelection } from './appointment-type-slot-selection';
import { terminalErrorCopy } from './public-booking-flow';
import { BookingProgress } from './booking-progress';

/** This flow's steps, in order — one MORE than the single-calendar flow's
 * (`public-booking-flow.tsx`'s `BOOKING_STEPS`): choosing a calendar per
 * slot is a real, extra step an appointment type booking has and a calendar booking
 * doesn't. Rendered only while the attendee is still mid-flow. */
const APPOINTMENT_TYPE_BOOKING_STEPS = [
  'Pick a time',
  'Choose calendars',
  'Your details',
];

/** How far ahead the whole-appointment-type proposal search window looks — matches
 * the single-calendar flow's default; see that constant's comment in
 * `public-booking-flow.tsx` for why 30 (a month grid, not a flat list). */
const SEARCH_WINDOW_DAYS = 30;

/**
 * No anonymous attendee titles their own appointment type appointment either — same
 * reasoning as the single-calendar flow's `DEFAULT_PUBLIC_BOOKING_TITLE`.
 */
const DEFAULT_PUBLIC_APPOINTMENT_TYPE_BOOKING_TITLE = 'Appointment';

type FlowStep =
  | 'select-proposal'
  | 'select-appointment-type-slots'
  | 'attendee-details'
  | 'confirmed'
  | 'terminal-error';

export interface PublicAppointmentTypeBookingFlowProps {
  /** Plaintext booking code from the URL. */
  code: string;
  /**
   * Active organization slug, when known — threaded down from the branded
   * `/o/[slug]/book/[code]` page so `BookingConfirmation` can build branded
   * self-service links. `undefined` on the bare `/book/[code]` route.
   */
  slug?: string;
}

/** Build the public AppointmentTypeSlotSelection view models from one range's
 * per-slot availability. The public API discloses only the free candidate
 * ids per slot — no name, no fuller pool — so `pool` here is always exactly
 * `available_calendar_ids`, relabeled generically by `appointment-type-slot-selection.tsx`
 * (never a real calendar/owner name). */
function toSlotViewModels(
  slots: AppointmentTypeSlotAvailability[]
): SlotViewModel[] {
  return slots.map((slot, index) => ({
    slotId: slot.slot_id,
    name: `Slot ${index + 1}`,
    requiredCount: slot.required_count,
    pool: slot.available_calendar_ids.map((id) => ({
      id,
      name: `Option ${id}`,
    })),
    availableCalendarIds: slot.available_calendar_ids,
  }));
}

export function PublicAppointmentTypeBookingFlow({
  code,
  slug,
}: PublicAppointmentTypeBookingFlowProps) {
  // Computed once per mount — a sliding search window mid-flow would be a
  // confusing moving target for the attendee.
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
  const [step, setStep] = React.useState<FlowStep>('select-proposal');
  const [selectedProposal, setSelectedProposal] =
    React.useState<BookableSlotProposal | null>(null);
  const [slotViews, setSlotViews] = React.useState<SlotViewModel[]>([]);
  const [selection, setSelection] = React.useState<Record<number, number[]>>(
    {}
  );
  const [slotSelectionsPayload, setSlotSelectionsPayload] = React.useState<
    AppointmentTypeSlotSelectionInput[] | null
  >(null);
  const [confirmedEvent, setConfirmedEvent] =
    React.useState<CalendarEventWithManagementCodes | null>(null);
  const [terminalFailure, setTerminalFailure] =
    React.useState<PublicWriteFailure | null>(null);
  const [slotUnavailableNotice, setSlotUnavailableNotice] =
    React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] =
    React.useState(false);
  const [linkInvalid, setLinkInvalid] = React.useState(false);

  const proposalsQuery = usePublicAppointmentTypeBookableSlots({
    code,
    durationSeconds: APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
  });

  const { bookAppointmentTypeEvent, bookAppointmentTypeEventMutation } =
    usePublicAppointmentTypeBookEvent();

  // Belt-and-suspenders alongside `usePublicAppointmentTypeBookEvent`'s `gcTime: 0` —
  // see `public-booking-flow.tsx`'s identical cleanup for why.
  const resetBookAppointmentTypeEventMutation =
    bookAppointmentTypeEventMutation.reset;
  React.useEffect(
    () => resetBookAppointmentTypeEventMutation,
    [resetBookAppointmentTypeEventMutation]
  );

  const loadSlotAvailability = async (proposal: BookableSlotProposal) => {
    setIsLoadingAvailability(true);
    setAvailabilityError(false);
    try {
      const rangeAvailability =
        await fetchPublicAppointmentTypeSlotAvailability({
          code,
          startTime: proposal.start_time,
          endTime: proposal.end_time,
        });
      const views = toSlotViewModels(rangeAvailability?.slots ?? []);
      setSlotViews(views);
      setSelection({});
      setStep('select-appointment-type-slots');
    } catch (err) {
      if (
        err instanceof PublicReadFailureError &&
        err.state === 'link-invalid'
      ) {
        setLinkInvalid(true);
        return;
      }
      setAvailabilityError(true);
    } finally {
      setIsLoadingAvailability(false);
    }
  };

  const handleSelectProposal = (proposal: BookableSlotProposal) => {
    setSlotUnavailableNotice(false);
    setSelectedProposal(proposal);
    void loadSlotAvailability(proposal);
  };

  const handleAppointmentTypeSlotsSubmit = (
    slotSelections: AppointmentTypeSlotSelectionInput[]
  ) => {
    setSlotSelectionsPayload(slotSelections);
    setStep('attendee-details');
  };

  const handleAttendeeSubmit = async (values: AttendeeFormValues) => {
    if (!selectedProposal || !slotSelectionsPayload) return;
    try {
      const event = await bookAppointmentTypeEvent({
        code,
        body: {
          title: DEFAULT_PUBLIC_APPOINTMENT_TYPE_BOOKING_TITLE,
          start_time: selectedProposal.start_time,
          end_time: selectedProposal.end_time,
          timezone,
          slot_selections: slotSelectionsPayload,
          external_attendee: values.name
            ? { email: values.email, name: values.name }
            : { email: values.email },
        },
      });
      setConfirmedEvent(event);
      setStep('confirmed');
    } catch (err) {
      if (err instanceof PublicWriteFailureError) {
        if (err.failure.isRetryable) {
          // SLOT_UNAVAILABLE — the code was NOT consumed. A slot going busy
          // between the availability check and submit most plausibly means
          // the chosen TIME is no longer good, so send the attendee all the
          // way back to whole-appointment-type time selection with a fresh proposal
          // list, not just back to the per-slot step.
          setSelectedProposal(null);
          setSlotViews([]);
          setSelection({});
          setSlotSelectionsPayload(null);
          setSlotUnavailableNotice(true);
          setStep('select-proposal');
          void proposalsQuery.refetch();
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

  if (linkInvalid) {
    return <LinkInvalid />;
  }

  if (proposalsQuery.isError) {
    const readError = proposalsQuery.error;
    if (
      readError instanceof PublicReadFailureError &&
      readError.state === 'link-invalid'
    ) {
      return <LinkInvalid />;
    }
    return (
      <Card data-testid='appointment-type-slots-load-error'>
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
              onClick={() => void proposalsQuery.refetch()}
              data-testid='retry-load-appointment-type-slots'
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
      <Card data-testid='appointment-type-booking-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='appointment-type-booking-terminal-error-description'
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
        scope={{ kind: 'appointmentType' }}
        slug={slug}
      />
    );
  }

  const currentStep =
    step === 'select-proposal'
      ? 0
      : step === 'select-appointment-type-slots'
        ? 1
        : 2;

  return (
    <VStack gap={4}>
      <Heading level={1} size='xl'>
        Book an appointment
      </Heading>

      <BookingProgress
        steps={APPOINTMENT_TYPE_BOOKING_STEPS}
        currentStep={currentStep}
      />

      {slotUnavailableNotice ? (
        <Alert
          variant='warning'
          data-testid='appointment-type-slot-unavailable-notice'
        >
          <Icon icon={TriangleAlert} size='sm' />
          <AlertTitle>That time was just taken</AlertTitle>
          <AlertDescription>Pick another time below.</AlertDescription>
        </Alert>
      ) : null}

      {step === 'select-proposal' ? (
        <SlotPicker
          proposals={proposalsQuery.data ?? []}
          timezone={timezone}
          selectedSlot={selectedProposal}
          onSelect={handleSelectProposal}
          onTimezoneChange={setTimezone}
          isLoading={proposalsQuery.isLoading || isLoadingAvailability}
        />
      ) : null}

      {availabilityError ? (
        <Card data-testid='appointment-type-availability-load-error'>
          <CardHeader>
            <CardTitle>We couldn&apos;t load options for that time</CardTitle>
          </CardHeader>
          <CardContent>
            <VStack gap={3}>
              <Text color='muted-foreground'>
                Something went wrong checking availability. Please try again.
              </Text>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  selectedProposal &&
                  void loadSlotAvailability(selectedProposal)
                }
                data-testid='retry-load-appointment-type-availability'
              >
                Try again
              </Button>
            </VStack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'select-appointment-type-slots' && selectedProposal ? (
        <VStack gap={4}>
          <Card data-testid='selected-proposal-summary'>
            <CardContent>
              <Text size='sm' color='muted-foreground'>
                {proposalDurationMinutes(selectedProposal)} min appointment
              </Text>
            </CardContent>
          </Card>
          <AppointmentTypeSlotSelection
            slots={slotViews}
            selection={selection}
            onToggle={(slotId, calendarId) =>
              setSelection((prev) => {
                const current = prev[slotId] ?? [];
                return current.includes(calendarId)
                  ? {
                      ...prev,
                      [slotId]: current.filter((id) => id !== calendarId),
                    }
                  : { ...prev, [slotId]: [...current, calendarId] };
              })
            }
            onSubmit={handleAppointmentTypeSlotsSubmit}
            onBack={() => setStep('select-proposal')}
          />
        </VStack>
      ) : null}

      {step === 'attendee-details' ? (
        <AttendeeForm
          timezone={timezone}
          isSubmitting={bookAppointmentTypeEventMutation.isPending}
          onSubmit={handleAttendeeSubmit}
          onBack={() => setStep('select-appointment-type-slots')}
        />
      ) : null}
    </VStack>
  );
}
