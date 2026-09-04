'use client';

/**
 * PublicGroupBookingFlow — the group-scoped public booking flow (Phase 3),
 * the group analogue of `public-booking-flow.tsx`.
 *
 * Orchestrates: read whole-group time proposals → pick one → read per-slot
 * availability for that specific range → pick a calendar for each slot
 * (`GroupSlotSelection`) → collect attendee details → write the booking →
 * terminal state. Branding chrome lives one level up in
 * `PublicBookingShell`.
 *
 * ERROR / DATA-TRUST RULES (mirroring `public-booking-flow.tsx`'s three):
 *
 * 1. `CalendarGroup.duration` is server-pinned, and a group-scoped booking
 *    link carries no `?duration=` at all (see the plan's "Group duration
 *    comes from the server" guiding decision — `build-url.ts` makes a
 *    client-chosen duration for a group link unrepresentable, not just
 *    discouraged). `GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS` (shared
 *    from `@/lib/booking-links/group-slots-duration-placeholder`) exists
 *    ONLY to satisfy the bookable-slots read's required
 *    `duration_seconds` param; when the group pins a duration (the normal
 *    case for any group a link was minted for) it's silently overridden and
 *    never reaches the UI. The rendered length always comes from the
 *    selected `BookableSlotProposal`'s own span, via
 *    `slot-picker.tsx`'s `proposalDurationMinutes` — never this constant.
 * 2. Every code-gated read failure (initial proposals OR the per-range
 *    availability check) surfaces as `PublicReadFailureError('link-invalid')`
 *    and renders the ONE undifferentiated `<LinkInvalid />` — same rule,
 *    same reasoning as the single-calendar flow.
 * 3. The write's `SLOT_UNAVAILABLE` does NOT consume the code, so it returns
 *    the attendee all the way to whole-group time selection (not just the
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
  CalendarEvent,
  CalendarGroupSlotAvailability,
  CalendarGroupSlotSelectionInput,
} from '@/client';
import { DateTime } from '@/lib/datetime/index';
import {
  usePublicGroupBookableSlots,
  fetchPublicGroupSlotAvailability,
  usePublicGroupBookEvent,
} from '@/hooks/booking-codes/use-public-group-booking';
import {
  PublicReadFailureError,
  PublicWriteFailureError,
  type PublicWriteFailure,
} from '@/lib/booking-links/errors';
import type { SlotViewModel } from '@/lib/booking-links/group-selection';
import { GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS } from '@/lib/booking-links/group-slots-duration-placeholder';
import { SlotPicker, proposalDurationMinutes } from './slot-picker';
import { AttendeeForm, type AttendeeFormValues } from './attendee-form';
import { BookingConfirmation } from './booking-confirmation';
import { LinkInvalid } from './link-invalid';
import { GroupSlotSelection } from './group-slot-selection';
import { terminalErrorCopy } from './public-booking-flow';

/** How far ahead the whole-group proposal search window looks — matches
 * the single-calendar flow's default; see that constant's comment in
 * `public-booking-flow.tsx` for why 30 (a month grid, not a flat list). */
const SEARCH_WINDOW_DAYS = 30;

/**
 * No anonymous attendee titles their own group appointment either — same
 * reasoning as the single-calendar flow's `DEFAULT_PUBLIC_BOOKING_TITLE`.
 */
const DEFAULT_PUBLIC_GROUP_BOOKING_TITLE = 'Appointment';

type FlowStep =
  | 'select-proposal'
  | 'select-group-slots'
  | 'attendee-details'
  | 'confirmed'
  | 'terminal-error';

export interface PublicGroupBookingFlowProps {
  /** Plaintext booking code from the URL. */
  code: string;
}

/** Build the public GroupSlotSelection view models from one range's
 * per-slot availability. The public API discloses only the free candidate
 * ids per slot — no name, no fuller pool — so `pool` here is always exactly
 * `available_calendar_ids`, relabeled generically by `group-slot-selection.tsx`
 * (never a real calendar/owner name). */
function toSlotViewModels(
  slots: CalendarGroupSlotAvailability[]
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

export function PublicGroupBookingFlow({ code }: PublicGroupBookingFlowProps) {
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
    CalendarGroupSlotSelectionInput[] | null
  >(null);
  const [confirmedEvent, setConfirmedEvent] =
    React.useState<CalendarEvent | null>(null);
  const [terminalFailure, setTerminalFailure] =
    React.useState<PublicWriteFailure | null>(null);
  const [slotUnavailableNotice, setSlotUnavailableNotice] =
    React.useState(false);
  const [availabilityError, setAvailabilityError] = React.useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] =
    React.useState(false);
  const [linkInvalid, setLinkInvalid] = React.useState(false);

  const proposalsQuery = usePublicGroupBookableSlots({
    code,
    durationSeconds: GROUP_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS,
    searchWindowStart: searchWindow.start,
    searchWindowEnd: searchWindow.end,
  });

  const { bookGroupEvent, bookGroupEventMutation } = usePublicGroupBookEvent();

  const loadSlotAvailability = async (proposal: BookableSlotProposal) => {
    setIsLoadingAvailability(true);
    setAvailabilityError(false);
    try {
      const rangeAvailability = await fetchPublicGroupSlotAvailability({
        code,
        startTime: proposal.start_time,
        endTime: proposal.end_time,
      });
      const views = toSlotViewModels(rangeAvailability?.slots ?? []);
      setSlotViews(views);
      setSelection({});
      setStep('select-group-slots');
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

  const handleGroupSlotsSubmit = (
    slotSelections: CalendarGroupSlotSelectionInput[]
  ) => {
    setSlotSelectionsPayload(slotSelections);
    setStep('attendee-details');
  };

  const handleAttendeeSubmit = async (values: AttendeeFormValues) => {
    if (!selectedProposal || !slotSelectionsPayload) return;
    try {
      const event = await bookGroupEvent({
        code,
        body: {
          title: DEFAULT_PUBLIC_GROUP_BOOKING_TITLE,
          start_time: selectedProposal.start_time,
          end_time: selectedProposal.end_time,
          timezone: values.timezone,
          slot_selections: slotSelectionsPayload,
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
          // SLOT_UNAVAILABLE — the code was NOT consumed. A slot going busy
          // between the availability check and submit most plausibly means
          // the chosen TIME is no longer good, so send the attendee all the
          // way back to whole-group time selection with a fresh proposal
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
      <Card data-testid='group-slots-load-error'>
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
              data-testid='retry-load-group-slots'
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
      <Card data-testid='group-booking-terminal-error'>
        <CardHeader>
          <HStack gap={2} align='center'>
            <Icon icon={Ban} color='destructive' aria-hidden />
            <CardTitle>{title}</CardTitle>
          </HStack>
        </CardHeader>
        <CardContent>
          <Text
            color='muted-foreground'
            data-testid='group-booking-terminal-error-description'
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
        Book an appointment
      </Heading>

      {slotUnavailableNotice ? (
        <Alert variant='warning' data-testid='group-slot-unavailable-notice'>
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
          isLoading={proposalsQuery.isLoading || isLoadingAvailability}
        />
      ) : null}

      {availabilityError ? (
        <Card data-testid='group-availability-load-error'>
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
                data-testid='retry-load-group-availability'
              >
                Try again
              </Button>
            </VStack>
          </CardContent>
        </Card>
      ) : null}

      {step === 'select-group-slots' && selectedProposal ? (
        <VStack gap={4}>
          <Card data-testid='selected-proposal-summary'>
            <CardContent>
              <Text size='sm' color='muted-foreground'>
                {proposalDurationMinutes(selectedProposal)} min appointment
              </Text>
            </CardContent>
          </Card>
          <GroupSlotSelection
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
            onSubmit={handleGroupSlotsSubmit}
            onBack={() => setStep('select-proposal')}
          />
        </VStack>
      ) : null}

      {step === 'attendee-details' ? (
        <AttendeeForm
          defaultTimezone={timezone}
          isSubmitting={bookGroupEventMutation.isPending}
          onSubmit={handleAttendeeSubmit}
          onBack={() => setStep('select-group-slots')}
        />
      ) : null}
    </VStack>
  );
}
