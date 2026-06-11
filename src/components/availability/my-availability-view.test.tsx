/**
 * Tests for MyAvailabilityView component.
 *
 * Covers:
 * - Renders busy + free windows from a mocked useMyAvailability
 * - No-default empty state shows link to /calendars
 * - Loading skeleton shown while loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyAvailabilityView } from './my-availability-view';
import { useMyAvailability } from '@/hooks/availability/use-my-availability';
import type { AvailableTimeWindow } from '@/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/availability/use-my-availability');

const replace = vi.fn();
let currentSearch = '';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace })),
  usePathname: vi.fn(() => '/availability'),
  useSearchParams: vi.fn(() => new URLSearchParams(currentSearch)),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FREE: AvailableTimeWindow = {
  id: 1,
  start_time: '2025-06-01T09:00:00',
  end_time: '2025-06-01T12:00:00',
  can_book_partially: true,
};

const FIXTURE_BUSY = {
  id: 2,
  start_time: '2025-06-01T13:00:00',
  end_time: '2025-06-01T14:00:00',
  reason_description: 'Blocked time',
};

type UseMyAvailabilityReturn = ReturnType<typeof useMyAvailability>;

function makeHookResult(
  overrides: Partial<UseMyAvailabilityReturn> = {}
): UseMyAvailabilityReturn {
  return {
    defaultCalendar: {
      id: 10,
      name: 'Work Calendar',
      email: 'u@example.com',
      external_id: 'ext-10',
      provider: 'google',
      calendar_type: 'personal',
      capacity: null,
      manage_available_windows: false,
      visibility: 'active',
    },
    hasDefault: true,
    freeWindows: [],
    busyWindows: [],
    isLoading: false,
    isError: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MyAvailabilityView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearch = '';
    vi.mocked(useMyAvailability).mockReturnValue(makeHookResult());
  });

  // ---- Happy path -----------------------------------------------------------

  it('renders free windows when provided', () => {
    vi.mocked(useMyAvailability).mockReturnValue(
      makeHookResult({ freeWindows: [FIXTURE_FREE] })
    );
    render(<MyAvailabilityView />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders busy windows when provided', () => {
    vi.mocked(useMyAvailability).mockReturnValue(
      makeHookResult({ busyWindows: [FIXTURE_BUSY] })
    );
    render(<MyAvailabilityView />);
    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('shows the "includes events and blocked times" caption', () => {
    vi.mocked(useMyAvailability).mockReturnValue(
      makeHookResult({ freeWindows: [FIXTURE_FREE] })
    );
    render(<MyAvailabilityView />);
    expect(
      screen.getByText(/includes your events and blocked times/i)
    ).toBeInTheDocument();
  });

  // ---- No default calendar empty state -------------------------------------

  it('shows empty state with link to /calendars when no default calendar', () => {
    vi.mocked(useMyAvailability).mockReturnValue(
      makeHookResult({ defaultCalendar: null, hasDefault: false })
    );
    render(<MyAvailabilityView />);
    expect(screen.getByText(/no default calendar yet/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /go to calendars/i });
    expect(link).toHaveAttribute('href', '/calendars');
  });

  // ---- Loading state -------------------------------------------------------

  it('shows loading skeleton while loading', () => {
    vi.mocked(useMyAvailability).mockReturnValue(
      makeHookResult({ isLoading: true })
    );
    const { container } = render(<MyAvailabilityView />);
    // Loading skeleton is shown, not the empty state
    expect(
      screen.queryByText(/no default calendar yet/i)
    ).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[class*="animate"]').length
    ).toBeGreaterThan(0);
  });

  // ---- Week pager ----------------------------------------------------------

  it('labels the current week as "This week" by default (no week param)', () => {
    render(<MyAvailabilityView />);
    expect(screen.getByText('This week')).toBeInTheDocument();
    // No "go to this week" reset button while already on the current week.
    expect(
      screen.queryByRole('button', { name: /go to this week/i })
    ).not.toBeInTheDocument();
  });

  it('labels a forward offset from ?week= relative to now', () => {
    currentSearch = 'week=1';
    render(<MyAvailabilityView />);
    expect(screen.getByText('Next week')).toBeInTheDocument();
  });

  it('labels a backward offset from ?week= relative to now', () => {
    currentSearch = 'week=-2';
    render(<MyAvailabilityView />);
    expect(screen.getByText('2 weeks ago')).toBeInTheDocument();
  });

  it('advances the week via router.replace when Next week is clicked', async () => {
    const user = userEvent.setup();
    render(<MyAvailabilityView />);
    await user.click(screen.getByRole('button', { name: /next week/i }));
    expect(replace).toHaveBeenCalledWith('/availability?week=1');
  });

  it('goes back a week via router.replace when Previous week is clicked', async () => {
    currentSearch = 'week=2';
    const user = userEvent.setup();
    render(<MyAvailabilityView />);
    await user.click(screen.getByRole('button', { name: /previous week/i }));
    expect(replace).toHaveBeenCalledWith('/availability?week=1');
  });

  it('jumps back to the current week (clears the param) via "This week"', async () => {
    currentSearch = 'week=3';
    const user = userEvent.setup();
    render(<MyAvailabilityView />);
    await user.click(screen.getByRole('button', { name: /go to this week/i }));
    // week=0 is the default → param removed.
    expect(replace).toHaveBeenCalledWith('/availability');
  });
});
