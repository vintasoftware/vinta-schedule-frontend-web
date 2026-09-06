/**
 * AppointmentTypeAvailabilityPreview tests.
 *
 * Covers:
 * - the strip is collapsed by default and issues NO request until the admin
 *   opens it — the laziness requirement this phase exists to prove;
 * - a range where every probed day comes back not free renders the
 *   explicit "not available" state, not an error;
 * - a calendar with no appointment-type-scoped window at all in the picked range
 *   renders the distinct "no configuration" state, not the generic
 *   "not available" one -- there was nothing to probe (BLOCKER fix);
 * - an invalid/inverted picked range renders the distinct "pick a valid
 *   range" state, not "never free" (SHOULD-FIX);
 * - a request failure renders the error state (with a Retry action),
 *   distinct from the other three;
 * - a mixed range renders free, not-free, and unconfigured days distinctly.
 *
 * The response fixtures here echo what the REAL backend can produce: a
 * `AppointmentTypeRangeAvailability` entry only for a range this calendar has
 * an actual appointment-type-scoped window covering (the backend answers "available"
 * only when a range is fully covered by a single span -- see the hook's
 * module doc comment). A fixture claiming a 24-hour range is "available"
 * for a Tuesday/Thursday-only calendar cannot occur in production, so none
 * of these fixtures do that.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppointmentTypeScopedAvailabilityWindow } from '@/client';
import { AppointmentTypeAvailabilityPreview } from './appointment-type-availability-preview';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesAvailabilityCreate: vi.fn(),
    appointmentTypesSlotsAvailabilityWindowsList: vi.fn(),
  };
});

import {
  appointmentTypesAvailabilityCreate,
  appointmentTypesSlotsAvailabilityWindowsList,
} from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const APPOINTMENT_TYPE_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 42;

// The picked range in every test below is 2026-08-10 (Mon) - 2026-08-13
// (Thu). Tuesday is 08-11, Thursday is 08-13.

function makeWindow(
  overrides: Partial<AppointmentTypeScopedAvailabilityWindow>
): AppointmentTypeScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: CALENDAR_ID,
    appointment_type_slot_id: SLOT_ID,
    start_time: '2024-01-02T09:00:00Z', // Tuesday
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// Tuesday-and-Thursday 9am-5pm UTC -- the plan's own UC-7 acceptance
// scenario.
const TUE_THU_WINDOWS: AppointmentTypeScopedAvailabilityWindow[] = [
  makeWindow({ id: 1 }),
  makeWindow({
    id: 2,
    rrule_string: 'FREQ=WEEKLY;BYDAY=TH',
    start_time: '2024-01-04T09:00:00Z', // Thursday
    end_time: '2024-01-04T17:00:00Z',
  }),
];

function makeWindowsListResponse(
  results: AppointmentTypeScopedAvailabilityWindow[]
) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
  >;
}

// One entry per probed sub-range -- NOT one per whole day. `available: true`
// means the probed window is fully covered by a single span (the only shape
// the real backend can answer "available" for).
function makeAvailabilityResponse(
  results: {
    start_time: string;
    end_time: string;
    available: boolean;
  }[]
) {
  const body = {
    count: results.length,
    results: results.map((r) => ({
      start_time: r.start_time,
      end_time: r.end_time,
      slots: [
        {
          slot_id: SLOT_ID,
          available_calendar_ids: r.available ? [CALENDAR_ID] : [],
          required_count: 1,
          is_bookable: r.available,
        },
      ],
    })),
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesAvailabilityCreate>
  >;
}

function renderPreview(
  props: Partial<
    React.ComponentProps<typeof AppointmentTypeAvailabilityPreview>
  > = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <AppointmentTypeAvailabilityPreview
      appointmentTypeId={APPOINTMENT_TYPE_ID}
      slotId={SLOT_ID}
      calendarId={CALENDAR_ID}
      calendarName='Dr. Reyes'
      initialStartDate='2026-08-10'
      initialEndDate='2026-08-13'
      initialTimezone='UTC'
      {...props}
    />,
    { wrapper }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentTypeAvailabilityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is collapsed by default and issues no request until opened', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(TUE_THU_WINDOWS)
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );

    renderPreview();

    expect(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    ).toHaveTextContent('Show preview');
    expect(
      screen.queryByTestId(`availability-preview-panel-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();

    // Give any accidental eager fetch a chance to happen before asserting
    // its absence.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appointmentTypesSlotsAvailabilityWindowsList).not.toHaveBeenCalled();
    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(`availability-preview-panel-${CALENDAR_ID}`)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(appointmentTypesAvailabilityCreate).toHaveBeenCalledTimes(1)
    );
  });

  it('a range where every probed day comes back not free renders the "not available" state, not an error', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(TUE_THU_WINDOWS)
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([
        {
          start_time: '2026-08-11T09:00:00.000Z',
          end_time: '2026-08-11T17:00:00.000Z',
          available: false,
        },
        {
          start_time: '2026-08-13T09:00:00.000Z',
          end_time: '2026-08-13T17:00:00.000Z',
          available: false,
        },
      ])
    );

    const user = userEvent.setup();
    renderPreview();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).toBeInTheDocument();
    expect(screen.getByText('Not available in this range')).toBeInTheDocument();

    // Distinctness: the error state's testid, its "Retry" action, the
    // no-configuration state, and the invalid-range state are all absent
    // here -- this is a genuine "never free" answer, not any of those.
    expect(
      screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-unconfigured-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-invalid-range-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-days-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });

  it('a calendar with no appointment-type-scoped window in the picked range renders the "no configuration" state, distinct from "not available"', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse([])
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );

    const user = userEvent.setup();
    renderPreview();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(
        `availability-preview-unconfigured-${CALENDAR_ID}`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('No appointment-type-scoped configuration for this slot')
    ).toBeInTheDocument();

    // The availability endpoint is never asked about a day with nothing to
    // probe -- there is no full-day fallback.
    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });

  it('an invalid/inverted picked range renders the "pick a valid range" state, not "never free"', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(TUE_THU_WINDOWS)
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([])
    );

    const user = userEvent.setup();
    renderPreview({
      initialStartDate: '2026-08-13',
      initialEndDate: '2026-08-10', // inverted
    });
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(
        `availability-preview-invalid-range-${CALENDAR_ID}`
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Pick a valid date range')).toBeInTheDocument();

    expect(appointmentTypesAvailabilityCreate).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-unconfigured-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });

  it('a request failure renders the error state with a Retry action, distinct from the other states', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(TUE_THU_WINDOWS)
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockRejectedValue(
      new Error('network down')
    );

    const user = userEvent.setup();
    renderPreview();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).toBeInTheDocument();
    expect(screen.getByText("Couldn't load the preview")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    // Distinctness: the legitimate-empty-result testid never renders for a
    // transport failure.
    expect(
      screen.queryByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();

    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([
        {
          start_time: '2026-08-11T09:00:00.000Z',
          end_time: '2026-08-11T17:00:00.000Z',
          available: true,
        },
        {
          start_time: '2026-08-13T09:00:00.000Z',
          end_time: '2026-08-13T17:00:00.000Z',
          available: false,
        },
      ])
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() =>
      expect(
        screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
      ).not.toBeInTheDocument()
    );
  });

  it('a mixed range renders free, not-free, and unconfigured days distinctly', async () => {
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeWindowsListResponse(TUE_THU_WINDOWS)
    );
    vi.mocked(appointmentTypesAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([
        {
          start_time: '2026-08-11T09:00:00.000Z',
          end_time: '2026-08-11T17:00:00.000Z',
          available: true, // Tuesday
        },
        {
          start_time: '2026-08-13T09:00:00.000Z',
          end_time: '2026-08-13T17:00:00.000Z',
          available: false, // Thursday
        },
      ])
    );

    const user = userEvent.setup();
    renderPreview();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    await screen.findByTestId(`availability-preview-days-${CALENDAR_ID}`);

    const mondayCard = screen.getByTestId(
      'availability-preview-day-2026-08-10'
    );
    const tuesdayCard = screen.getByTestId(
      'availability-preview-day-2026-08-11'
    );
    const thursdayCard = screen.getByTestId(
      'availability-preview-day-2026-08-13'
    );

    expect(mondayCard).toHaveTextContent('No config');
    expect(tuesdayCard).toHaveTextContent('Free');
    expect(thursdayCard).toHaveTextContent('Not free');

    // The free day carries the design system's `success` Badge variant --
    // asserted at the testid/text level above, distinctness proven by the
    // Not-free/No-config cards NOT carrying that same text.
    expect(
      screen.getByTestId(
        `availability-preview-unconfigured-note-${CALENDAR_ID}`
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });
});
