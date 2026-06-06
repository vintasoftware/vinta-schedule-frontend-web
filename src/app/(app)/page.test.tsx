import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Mocks — all vi.mock calls must be at the top level so Vitest can hoist them.
// ---------------------------------------------------------------------------

// next/navigation — page uses Link (no hooks directly, but layout may)
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// sonner — toast calls made in handleSync
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Hook mocks — we mock at the hook module level so there's no TanStack Query
// dependency in these tests.

vi.mock('@/hooks/users/use-profile', () => ({
  useProfile: vi.fn(),
}));

vi.mock('@/hooks/events/use-calendar-events', () => ({
  useCalendarEvents: vi.fn(),
}));

vi.mock('@/hooks/calendars/use-my-calendars', () => ({
  useMyCalendars: vi.fn(),
}));

vi.mock('@/hooks/availability/use-blocked-times', () => ({
  useBlockedTimes: vi.fn(),
}));

vi.mock('@/hooks/calendars/use-request-calendar-sync', () => ({
  useRequestCalendarSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports after mocks are hoisted
// ---------------------------------------------------------------------------

import { useProfile } from '@/hooks/users/use-profile';
import { useCalendarEvents } from '@/hooks/events/use-calendar-events';
import { useMyCalendars } from '@/hooks/calendars/use-my-calendars';
import { useBlockedTimes } from '@/hooks/availability/use-blocked-times';
import { useRequestCalendarSync } from '@/hooks/calendars/use-request-calendar-sync';
import { toast } from 'sonner';

import DashboardPage from './page';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEventVM(overrides: {
  id?: string;
  title?: string;
  timezone?: string;
  timezoneLabel?: string;
  startDt?: DateTime;
}) {
  const startDt =
    overrides.startDt ??
    DateTime.fromISO('2026-06-10T09:00:00', { zone: 'UTC' });
  return {
    id: overrides.id ?? '1',
    title: overrides.title ?? 'Test Event',
    start: startDt.toJSDate(),
    end: startDt.plus({ hours: 1 }).toJSDate(),
    startDt,
    endDt: startDt.plus({ hours: 1 }),
    timezone: overrides.timezone ?? 'UTC',
    timezoneLabel: overrides.timezoneLabel ?? 'UTC (UTC+0)',
    calendarId: undefined,
    recurrenceRule: undefined,
    isRecurring: false,
    isRecurringException: false,
    status: 'confirmed' as const,
    _raw: {} as unknown as import('@/client').CalendarEvent,
  };
}

function buildCalendar(overrides: {
  id?: number;
  name?: string;
  provider?: string;
}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Work Calendar',
    description: '',
    email: 'user@example.com',
    external_id: 'ext-1',
    provider: overrides.provider ?? 'google',
    calendar_type: 'personal' as const,
    capacity: null,
    manage_available_windows: false,
    is_active: true,
  };
}

/** Set up all hook mocks with sensible defaults. */
function setupMocks({
  profile = { first_name: 'Alice', last_name: 'Smith' },
  profileLoading = false,
  events = [] as ReturnType<typeof buildEventVM>[],
  eventsLoading = false,
  eventsError = false,
  calendars = [] as ReturnType<typeof buildCalendar>[],
  calendarTotal = 0,
  calendarsLoading = false,
  calendarsError = false,
  blockedTimes = [] as unknown[],
  blockedLoading = false,
  requestSync = vi.fn().mockResolvedValue(undefined),
  isPending = false,
} = {}) {
  vi.mocked(useProfile).mockReturnValue({
    profile: profile as unknown as ReturnType<typeof useProfile>['profile'],
    isLoading: profileLoading,
    isError: false,
    profileQuery: {} as unknown as ReturnType<
      typeof useProfile
    >['profileQuery'],
  });

  vi.mocked(useCalendarEvents).mockReturnValue({
    events: events as unknown as ReturnType<typeof useCalendarEvents>['events'],
    truncated: false,
    isLoading: eventsLoading,
    isError: eventsError,
    error: null,
    eventsQuery: {} as unknown as ReturnType<
      typeof useCalendarEvents
    >['eventsQuery'],
  });

  vi.mocked(useMyCalendars).mockReturnValue({
    calendars: calendars as unknown as ReturnType<
      typeof useMyCalendars
    >['calendars'],
    totalCount: calendarTotal,
    isLoading: calendarsLoading,
    isError: calendarsError,
    error: null,
    calendarsQuery: {} as unknown as ReturnType<
      typeof useMyCalendars
    >['calendarsQuery'],
  });

  vi.mocked(useBlockedTimes).mockReturnValue({
    blockedTimes: blockedTimes as unknown as ReturnType<
      typeof useBlockedTimes
    >['blockedTimes'],
    isLoading: blockedLoading,
    isError: false,
    error: null,
    blockedTimesQuery: {} as unknown as ReturnType<
      typeof useBlockedTimes
    >['blockedTimesQuery'],
    createBlockedTime: vi.fn(),
    createRecurringBlockedTime: vi.fn(),
    bulkCreateMutation: {} as unknown as ReturnType<
      typeof useBlockedTimes
    >['bulkCreateMutation'],
    isPending: false,
  });

  const requestSyncMutation = {
    isPending,
    mutateAsync: vi.fn(),
  };

  vi.mocked(useRequestCalendarSync).mockReturnValue({
    requestSync,
    requestSyncMutation: requestSyncMutation as unknown as ReturnType<
      typeof useRequestCalendarSync
    >['requestSyncMutation'],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  // ---- Greeting ------------------------------------------------------------

  it('shows the profile first name in the greeting', () => {
    setupMocks({ profile: { first_name: 'Bob', last_name: 'Jones' } });
    render(<DashboardPage />);
    expect(screen.getByText('Good day, Bob')).toBeInTheDocument();
  });

  it('falls back to "Welcome" when profile has no first name', () => {
    setupMocks({ profile: { first_name: '', last_name: '' } });
    render(<DashboardPage />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('shows "Dashboard" while profile is loading', () => {
    setupMocks({
      profileLoading: true,
      profile: null as unknown as { first_name: string; last_name: string },
    });
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  // ---- Up next tile --------------------------------------------------------

  it('renders event titles from the mocked events array', () => {
    const events = [
      buildEventVM({ id: '1', title: 'Team standup' }),
      buildEventVM({ id: '2', title: 'Design review' }),
    ];
    setupMocks({ events });
    render(<DashboardPage />);
    expect(screen.getByText('Team standup')).toBeInTheDocument();
    expect(screen.getByText('Design review')).toBeInTheDocument();
  });

  it('shows empty state when there are no upcoming events', () => {
    setupMocks({ events: [] });
    render(<DashboardPage />);
    expect(screen.getByText('No upcoming events')).toBeInTheDocument();
    // Multiple "Connect a calendar" links may exist (up-next + calendars tiles)
    const links = screen.getAllByRole('link', { name: 'Connect a calendar' });
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('shows an inline error message when events query errors', () => {
    setupMocks({ eventsError: true });
    render(<DashboardPage />);
    expect(screen.getByText('Unable to load events.')).toBeInTheDocument();
  });

  it('renders event loading skeletons when events are loading', () => {
    setupMocks({ eventsLoading: true });
    render(<DashboardPage />);
    // Skeletons are rendered; no event titles appear.
    expect(screen.queryByText('No upcoming events')).not.toBeInTheDocument();
  });

  // ---- My calendars tile ---------------------------------------------------

  it('shows the connected calendar count', () => {
    const calendars = [
      buildCalendar({ id: 1, name: 'Work' }),
      buildCalendar({ id: 2, name: 'Personal' }),
      buildCalendar({ id: 3, name: 'Family' }),
    ];
    setupMocks({ calendars, calendarTotal: 3 });
    render(<DashboardPage />);
    expect(screen.getByText('3 connected')).toBeInTheDocument();
  });

  it('shows calendar names', () => {
    const calendars = [
      buildCalendar({ id: 1, name: 'My Work Calendar', provider: 'google' }),
    ];
    setupMocks({ calendars, calendarTotal: 1 });
    render(<DashboardPage />);
    expect(screen.getByText('My Work Calendar')).toBeInTheDocument();
  });

  it('calls requestSync when the Sync button is clicked', async () => {
    const requestSync = vi.fn().mockResolvedValue(undefined);
    const calendars = [buildCalendar({ id: 42, name: 'Work Cal' })];
    setupMocks({ calendars, calendarTotal: 1, requestSync });
    render(<DashboardPage />);

    const syncButton = screen.getByRole('button', { name: 'Sync' });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(requestSync).toHaveBeenCalledTimes(1);
      expect(requestSync).toHaveBeenCalledWith(42);
    });
  });

  it('shows a success toast after sync completes', async () => {
    const requestSync = vi.fn().mockResolvedValue(undefined);
    const calendars = [buildCalendar({ id: 10, name: 'Cal' })];
    setupMocks({ calendars, calendarTotal: 1, requestSync });
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Sync started');
    });
  });

  it('shows an error toast when sync fails', async () => {
    const requestSync = vi.fn().mockRejectedValue(new Error('network'));
    const calendars = [buildCalendar({ id: 10, name: 'Cal' })];
    setupMocks({ calendars, calendarTotal: 1, requestSync });
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Sync failed — please try again'
      );
    });
  });

  it('shows the empty state when no calendars are connected', () => {
    setupMocks({ calendars: [], calendarTotal: 0 });
    render(<DashboardPage />);
    expect(screen.getByText('No calendars connected')).toBeInTheDocument();
  });

  it('renders calendar loading skeletons while loading', () => {
    setupMocks({ calendarsLoading: true });
    render(<DashboardPage />);
    expect(screen.queryByText('0 connected')).not.toBeInTheDocument();
  });

  // ---- Availability tile ---------------------------------------------------

  it('shows the blocked windows count', () => {
    setupMocks({ blockedTimes: [{ id: 1 }, { id: 2 }] });
    render(<DashboardPage />);
    expect(screen.getByText('2 blocked windows')).toBeInTheDocument();
  });

  it('shows "No blocked windows" when none exist', () => {
    setupMocks({ blockedTimes: [] });
    render(<DashboardPage />);
    expect(screen.getByText('No blocked windows')).toBeInTheDocument();
  });

  it('renders availability skeleton while loading', () => {
    setupMocks({ blockedLoading: true });
    render(<DashboardPage />);
    // Availability tile does not show count while loading
    expect(screen.queryByText('No blocked windows')).not.toBeInTheDocument();
  });

  it('shows singular "window" for a count of 1', () => {
    setupMocks({ blockedTimes: [{ id: 1 }] });
    render(<DashboardPage />);
    expect(screen.getByText('1 blocked window')).toBeInTheDocument();
  });

  // ---- Quick actions tile --------------------------------------------------

  it('renders all quick action links', () => {
    render(<DashboardPage />);
    expect(
      screen.getByRole('link', { name: 'Connect calendar' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Set availability' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View events' })
    ).toBeInTheDocument();
  });

  // ---- Loading state sanity ------------------------------------------------

  it('renders without crashing when all tiles are loading', () => {
    setupMocks({
      profileLoading: true,
      eventsLoading: true,
      calendarsLoading: true,
      blockedLoading: true,
      profile: null as unknown as { first_name: string; last_name: string },
      events: [],
      calendars: [],
      blockedTimes: [],
    });
    expect(() => render(<DashboardPage />)).not.toThrow();
  });
});
