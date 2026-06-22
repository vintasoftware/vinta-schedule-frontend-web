/**
 * Tests for UserAvailabilityView component.
 *
 * Covers:
 * - Renders the colleague picker and date range inputs
 * - Shows the resolution notice
 * - Selecting a colleague resolves their calendar and enables the check
 * - Submitting renders free/busy windows
 * - Free windows are labelled "Free", busy windows "Busy"
 * - No private event titles are shown
 * - Loading state
 * - Error state
 * - Empty state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { UserAvailabilityView } from './user-availability-view';
import { useUserAvailability } from '@/hooks/availability/use-user-availability';
import { useColleagueCalendars } from '@/hooks/availability/use-colleague-calendars';
import { useOrgMemberSearch } from '@/hooks/team/use-org-member-search';
import type {
  AvailableTimeWindow,
  UnavailableTimeWindow,
  Calendar,
} from '@/client';

// ---------------------------------------------------------------------------
// Mock the hooks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/availability/use-user-availability');
vi.mock('@/hooks/availability/use-colleague-calendars');
vi.mock('@/hooks/team/use-org-member-search');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FREE: AvailableTimeWindow = {
  id: 1,
  start_time: '2025-06-01T09:00:00',
  end_time: '2025-06-01T12:00:00',
  can_book_partially: true,
};

const FIXTURE_BUSY: UnavailableTimeWindow = {
  id: 2,
  reason: 'blocked',
  start_time: '2025-06-01T13:00:00',
  end_time: '2025-06-01T14:00:00',
  reason_description: 'Blocked time',
};

const FIXTURE_MEMBER = {
  id: 42,
  name: 'Casey Colleague',
  email: 'casey@example.com',
};

const FIXTURE_CALENDAR = {
  id: 7,
  name: "Casey's Calendar",
  calendar_type: 'personal',
} as unknown as Calendar;

type UseUserAvailabilityReturn = ReturnType<typeof useUserAvailability>;

function makeHookResult(
  overrides: Partial<UseUserAvailabilityReturn> = {}
): UseUserAvailabilityReturn {
  return {
    freeWindows: [],
    busyWindows: [],
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

/** Selects the colleague and fills the date range so "Check availability" enables. */
async function selectColleagueAndDates(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole('combobox', { name: /^colleague$/i })
  );
  await user.click(await screen.findByText('Casey Colleague'));
  await user.type(screen.getByLabelText(/start date/i), '2025-06-01');
  await user.type(screen.getByLabelText(/end date/i), '2025-06-07');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserAvailabilityView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUserAvailability).mockReturnValue(makeHookResult());
    vi.mocked(useOrgMemberSearch).mockReturnValue({
      members: [FIXTURE_MEMBER],
      isLoading: false,
      isError: false,
    });
    vi.mocked(useColleagueCalendars).mockReturnValue({
      calendars: [FIXTURE_CALENDAR],
      isLoading: false,
      isError: false,
      error: null,
    });
  });

  it('renders the colleague picker and date inputs', () => {
    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    expect(
      screen.getByRole('combobox', { name: /^colleague$/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /check availability/i })
    ).toBeInTheDocument();
  });

  it('renders the resolution notice', () => {
    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    expect(
      screen.getByText(/search for a colleague to check their availability/i)
    ).toBeInTheDocument();
  });

  it('button is disabled when inputs are missing', () => {
    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    const btn = screen.getByRole('button', { name: /check availability/i });
    expect(btn).toBeDisabled();
  });

  it('renders free windows as "Free" after submitting', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ freeWindows: [FIXTURE_FREE] })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });
  });

  it('renders busy windows as "Busy" after submitting', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ busyWindows: [FIXTURE_BUSY] })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Busy')).toBeInTheDocument();
    });
  });

  it('does not render any private event title for free windows', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ freeWindows: [FIXTURE_FREE] })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument();
    });

    const container = document.body;
    expect(container.textContent).not.toMatch(/private event/i);
    expect(container.textContent).not.toMatch(/^title:/i);
  });

  it('shows reason_description for busy windows (non-private system label)', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ busyWindows: [FIXTURE_BUSY] })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/blocked time/i)).toBeInTheDocument();
    });
  });

  it('shows a calendar picker when the colleague has multiple calendars', async () => {
    const user = userEvent.setup();

    vi.mocked(useColleagueCalendars).mockReturnValue({
      calendars: [
        FIXTURE_CALENDAR,
        { id: 8, name: 'Secondary', calendar_type: 'personal' } as unknown as Calendar,
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await user.click(
      screen.getByRole('combobox', { name: /^colleague$/i })
    );
    await user.click(await screen.findByText('Casey Colleague'));

    expect(
      screen.getByRole('combobox', { name: /colleague calendar/i })
    ).toBeInTheDocument();
  });

  it('shows loading state with skeleton when isLoading is true', () => {
    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ isLoading: true })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    // When isLoading is true, the button text changes to "Loading…"
    expect(
      screen.getByRole('button', { name: /loading/i })
    ).toBeInTheDocument();
    // The button should be disabled while loading
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
  });

  it('shows error state when isError is true', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({
        isError: true,
        error: new Error('Network error'),
        isLoading: false,
      })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load availability/i)
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when no windows returned', async () => {
    const user = userEvent.setup();

    vi.mocked(useUserAvailability).mockReturnValue(
      makeHookResult({ freeWindows: [], busyWindows: [] })
    );

    const Wrapper = makeWrapper();
    render(<UserAvailabilityView />, { wrapper: Wrapper });

    await selectColleagueAndDates(user);
    await user.click(
      screen.getByRole('button', { name: /check availability/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no availability windows found/i)
      ).toBeInTheDocument();
    });
  });
});
