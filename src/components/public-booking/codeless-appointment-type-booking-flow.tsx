'use client';

/**
 * CodelessAppointmentTypeBookingFlow — the reusable, CODELESS appointment-type booking
 * flow (Phase 7). The codeless analogue of `public-appointment-type-booking-flow.tsx`
 * (Phase 3's coded appointment type flow), reusing Phase 2's shell (mounted one level
 * up by the page) and Phase 3's `<AppointmentTypeSlotSelection />`, `<SlotPicker />`,
 * `<AttendeeForm />`, and `<BookingConfirmation />` UNCHANGED. The only
 * things that differ from the coded flow are:
 *
 *  1. No code at all — the appointment type is addressed by its `public_booking_slug`
 *     straight from the route's path segment, never an `X-Booking-Code`
 *     header. This flow's hooks (`use-codeless-appointment-type-booking.ts`) never
 *     accept or send that header.
 *  2. No `duration_seconds` anywhere in this flow's requests — none of the
 *     three codeless endpoints takes one; the appointment type's own pinned
 *     `AppointmentType.duration` resolves server-side. The rendered length
 *     still always comes from the returned `BookableSlotProposal`s (via
 *     `slot-picker.tsx`'s `proposalDurationMinutes`), same "trust the
 *     response" discipline as every other public flow in this feature.
 *  3. The error contract: a READ failure is not one opaque state here.
 *     `CodelessAppointmentTypeReadFailureError.state` is `'not-found'` (unknown slug,
 *     404) or `'unavailable'` (a real, non-public — or duration-unset —
 *     appointment type, 403), and this flow renders those as two DISTINCT components,
 *     `<CodelessAppointmentTypeNotFound />` / `<CodelessAppointmentTypeUnavailable />`. See
 *     `@/lib/booking-links/codeless-appointment-type-read-errors` for why collapsing
 *     them the way the coded flow's `<LinkInvalid />` does would be wrong
 *     here.
 *
 * The WRITE's error vocabulary is unchanged: `SLOT_UNAVAILABLE` sends the
 * attendee all the way back to whole-appointment-type time selection with a refetched
 * proposal list (same reasoning as the coded flow — a slot going busy
 * between the availability check and submit most plausibly means the chosen
 * TIME is no longer good); every other `error_code` is terminal, reusing
 * `terminalErrorCopy` from `public-booking-flow.tsx` so the copy matches
 * every other public flow.
 *
 * REUSABILITY: unlike a booking code, a `public_booking_slug` is never
 * consumed. Booking through this flow a second time (a different attendee,
 * or the same one) works exactly the same way — nothing here is single-use.
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
  useCodelessAppointmentTypeBookableSlots,
  fetchCodelessAppointmentTypeSlotAvailability,
  useCodelessAppointmentTypeBookEvent,
} from '@/hooks/booking-codes/use-codeless-appointment-type-booking';
import {
  CodelessAppointmentTypeReadFailureError,
  type CodelessAppointmentTypeReadState,
} from '@/lib/booking-links/codeless-appointment-type-read-errors';
import {
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import type { SlotViewModel } from '@/lib/booking-links/appointment-type-selection';
import { SlotPicker, proposalDurationMinutes } from './slot-picker';
import { AttendeeForm, type AttendeeFormValues } from './attendee-form';
import { BookingConfirmation } from './booking-confirmation';
import { AppointmentTypeSlotSelection } from './appointment-type-slot-selection';
import { CodelessAppointmentTypeNotFound } from './codeless-appointment-type-not-found';
import { CodelessAppointmentTypeUnavailable } from './codeless-appointment-type-unavailable';
import { terminalErrorCopy } from './public-booking-flow';
import { BookingProgress } from './booking-progress';

/** Same three steps as the coded appointment type flow (`public-appointment-type-booking-flow.tsx`'s
 * `APPOINTMENT_TYPE_BOOKING_STEPS`) — a codeless appointment type booking is the same shape of
 * journey, just addressed by slug instead of a code. */
const CODELESS_APPOINTMENT_TYPE_BOOKING_STEPS = [
  'Pick a time',
  'Choose calendars',
  'Your details',
];

/** How far ahead the whole-appointment-type proposal search window looks — matches
 * every other public flow's default; see `public-booking-flow.tsx`'s
 * identical constant for why 30 (a month grid, not a flat list). */
const SEARCH_WINDOW_DAYS = 30;

/** No anonymous attendee titles their own appointment type appointment — same
 * reasoning as every other public flow's default title constant. */
const DEFAULT_PUBLIC_APPOINTMENT_TYPE_BOOKING_TITLE = 'Appointment';

type FlowStep =
  | 'select-proposal'
  | 'select-appointment-type-slots'
  | 'attendee-details'
  | 'confirmed'
  | 'terminal-error';

export interface CodelessAppointmentTypeBookingFlowProps {
  /** The appointment type's opaque, globally-unique `public_booking_slug`, from the route's path. */
  publicSlug: string;
  /**
   * Active organization slug, when known — threaded down from the branded
   * `/o/[slug]/g/[public_slug]` page so `BookingConfirmation` can build
   * branded self-service links. `undefined` on the bare `/g/[public_slug]`
   * route.
   */
  slug?: string;
}

/** Same shape as the coded flow's `toSlotViewModels` — the public API
 * discloses only the free candidate ids per slot, never a name or a fuller
 * pool, so `pool` here is always exactly `available_calendar_ids`,
 * relabeled generically by `appointment-type-slot-selection.tsx`. */
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

export function CodelessAppointmentTypeBookingFlow({
  publicSlug,
  slug,
}: CodelessAppointmentTypeBookingFlowProps) {
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
  const [availabilityReadState, setAvailabilityReadState] =
    React.useState<Exclude<CodelessAppointmentTypeReadState, 'ok'> | null>(
      null
    );

  const proposalsQuery = useCodelessAppointmentTypeBookableSlots({
    publicSlug,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
  });

  const { bookAppointmentTypeEvent, bookAppointmentTypeEventMutation } =
    useCodelessAppointmentTypeBookEvent();

  // Belt-and-suspenders alongside `useCodelessAppointmentTypeBookEvent`'s `gcTime: 0` —
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
        await fetchCodelessAppointmentTypeSlotAvailability({
          publicSlug,
          startTime: proposal.start_time,
          endTime: proposal.end_time,
        });
      const views = toSlotViewModels(rangeAvailability?.slots ?? []);
      setSlotViews(views);
      setSelection({});
      setStep('select-appointment-type-slots');
    } catch (err) {
      if (err instanceof CodelessAppointmentTypeReadFailureError) {
        if (err.state === 'not-found' || err.state === 'unavailable') {
          setAvailabilityReadState(err.state);
          return;
        }
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
        publicSlug,
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
          // SLOT_UNAVAILABLE — send the attendee all the way back to
          // whole-appointment-type time selection with a fresh proposal list, not just
          // back to the per-slot step. Nothing here was ever "consumed" —
          // this link stays reusable regardless.
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

  if (availabilityReadState === 'not-found') {
    return <CodelessAppointmentTypeNotFound />;
  }
  if (availabilityReadState === 'unavailable') {
    return <CodelessAppointmentTypeUnavailable />;
  }

  if (proposalsQuery.isError) {
    const readError = proposalsQuery.error;
    if (readError instanceof CodelessAppointmentTypeReadFailureError) {
      if (readError.state === 'not-found') {
        return <CodelessAppointmentTypeNotFound />;
      }
      if (readError.state === 'unavailable') {
        return <CodelessAppointmentTypeUnavailable />;
      }
    }
    return (
      <Card data-testid='codeless-appointment-type-slots-load-error'>
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
              data-testid='retry-load-codeless-appointment-type-slots'
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
      <Card data-testid='codeless-appointment-type-booking-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='codeless-appointment-type-booking-terminal-error-description'
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
        steps={CODELESS_APPOINTMENT_TYPE_BOOKING_STEPS}
        currentStep={currentStep}
      />

      {slotUnavailableNotice ? (
        <Alert
          variant='warning'
          data-testid='codeless-appointment-type-slot-unavailable-notice'
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
        <Card data-testid='codeless-appointment-type-availability-load-error'>
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
                data-testid='retry-load-codeless-appointment-type-availability'
              >
                Try again
              </Button>
            </VStack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'select-appointment-type-slots' && selectedProposal ? (
        <VStack gap={4}>
          <Card data-testid='codeless-selected-proposal-summary'>
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
