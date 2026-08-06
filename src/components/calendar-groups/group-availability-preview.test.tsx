/**
 * GroupAvailabilityPreview tests.
 *
 * Covers:
 * - the strip is collapsed by default and issues NO request until the admin
 *   opens it — the laziness requirement this phase exists to prove;
 * - a range where the calendar is never free renders the explicit empty
 *   state, not an error — proving the two are distinguishable;
 * - a request failure renders the error state (with a Retry action),
 *   distinct from the empty state;
 * - a mixed range renders free and not-free days distinctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { GroupAvailabilityPreview } from './group-availability-preview';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsAvailabilityCreate: vi.fn(),
  };
});

import { calendarGroupsAvailabilityCreate } from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const GROUP_ID = 1;
const SLOT_ID = 10;
const CALENDAR_ID = 42;

function makeResponse(
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
  } as unknown as Awaited<ReturnType<typeof calendarGroupsAvailabilityCreate>>;
}

function renderPreview(
  props: Partial<React.ComponentProps<typeof GroupAvailabilityPreview>> = {}
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <GroupAvailabilityPreview
      groupId={GROUP_ID}
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

describe('GroupAvailabilityPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is collapsed by default and issues no request until opened', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([])
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
    expect(calendarGroupsAvailabilityCreate).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    expect(
      await screen.findByTestId(`availability-preview-panel-${CALENDAR_ID}`)
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(calendarGroupsAvailabilityCreate).toHaveBeenCalledTimes(1)
    );
  });

  it('a range where the calendar is never free renders the empty state, not an error', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([
        {
          start_time: '2026-08-10T00:00:00.000Z',
          end_time: '2026-08-11T00:00:00.000Z',
          available: false,
        },
        {
          start_time: '2026-08-11T00:00:00.000Z',
          end_time: '2026-08-12T00:00:00.000Z',
          available: false,
        },
        {
          start_time: '2026-08-12T00:00:00.000Z',
          end_time: '2026-08-13T00:00:00.000Z',
          available: false,
        },
        {
          start_time: '2026-08-13T00:00:00.000Z',
          end_time: '2026-08-14T00:00:00.000Z',
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

    // Distinctness: the error state's testid, its "Retry" action, and the
    // "role=alert" destructive styling contract are all absent here -- this
    // is an answer, not a failure.
    expect(
      screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-days-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });

  it('a request failure renders the error state with a Retry action, distinct from the empty state', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockRejectedValue(
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

    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([
        {
          start_time: '2026-08-10T00:00:00.000Z',
          end_time: '2026-08-11T00:00:00.000Z',
          available: true,
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

  it('a mixed range renders free and not-free days distinctly', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeResponse([
        {
          start_time: '2026-08-10T00:00:00.000Z',
          end_time: '2026-08-11T00:00:00.000Z',
          available: false, // Monday
        },
        {
          start_time: '2026-08-11T00:00:00.000Z',
          end_time: '2026-08-12T00:00:00.000Z',
          available: true, // Tuesday
        },
        {
          start_time: '2026-08-12T00:00:00.000Z',
          end_time: '2026-08-13T00:00:00.000Z',
          available: false, // Wednesday
        },
        {
          start_time: '2026-08-13T00:00:00.000Z',
          end_time: '2026-08-14T00:00:00.000Z',
          available: true, // Thursday
        },
      ])
    );

    const user = userEvent.setup();
    renderPreview();
    await user.click(
      screen.getByTestId(`availability-preview-toggle-${CALENDAR_ID}`)
    );

    await screen.findByTestId(`availability-preview-days-${CALENDAR_ID}`);

    const freeDay = screen.getByTestId('availability-preview-day-2026-08-11');
    const busyDay = screen.getByTestId('availability-preview-day-2026-08-10');

    expect(freeDay).toHaveTextContent('Free');
    expect(busyDay).toHaveTextContent('Not free');
    // Not just different text -- distinct visual treatment too (own testid
    // fixture support: the badge variant classnames differ).
    expect(freeDay.querySelector('.bg-green-100')).not.toBeNull();
    expect(busyDay.querySelector('.bg-green-100')).toBeNull();

    expect(
      screen.queryByTestId(`availability-preview-empty-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`availability-preview-error-${CALENDAR_ID}`)
    ).not.toBeInTheDocument();
  });
});
