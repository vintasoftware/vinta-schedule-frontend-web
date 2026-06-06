/**
 * Tests for FreeBusyList component.
 *
 * Covers:
 * - Renders free window rows with "Free" badge
 * - Renders busy window rows with "Busy" badge
 * - Shows reason_description for busy entries
 * - Empty state when no windows
 * - Loading skeleton
 * - Error state
 * - calendarLabel shown in heading when provided
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FreeBusyList } from './free-busy-list';
import type { AvailableTimeWindow } from '@/client';
import type { BusyWindowEntry } from './free-busy-list';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_FREE: AvailableTimeWindow = {
  id: 1,
  start_time: '2025-06-01T09:00:00',
  end_time: '2025-06-01T12:00:00',
  can_book_partially: true,
};

const FIXTURE_BUSY: BusyWindowEntry = {
  id: 2,
  start_time: '2025-06-01T13:00:00',
  end_time: '2025-06-01T14:00:00',
  reason_description: 'Team standup',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FreeBusyList', () => {
  // ---- Happy path -----------------------------------------------------------

  it('renders a "Free" badge for free windows', () => {
    render(
      <FreeBusyList
        freeWindows={[FIXTURE_FREE]}
        busyWindows={[]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders a "Busy" badge for busy windows', () => {
    render(
      <FreeBusyList
        freeWindows={[]}
        busyWindows={[FIXTURE_BUSY]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('renders both free and busy windows together', () => {
    render(
      <FreeBusyList
        freeWindows={[FIXTURE_FREE]}
        busyWindows={[FIXTURE_BUSY]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Busy')).toBeInTheDocument();
  });

  it('shows reason_description for busy windows', () => {
    render(
      <FreeBusyList
        freeWindows={[]}
        busyWindows={[FIXTURE_BUSY]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.getByText('Team standup')).toBeInTheDocument();
  });

  it('shows the legend counts', () => {
    render(
      <FreeBusyList
        freeWindows={[FIXTURE_FREE]}
        busyWindows={[FIXTURE_BUSY]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.getByText('Free (1)')).toBeInTheDocument();
    expect(screen.getByText('Busy (1)')).toBeInTheDocument();
  });

  // ---- calendarLabel -------------------------------------------------------

  it('renders a heading with calendarLabel when provided', () => {
    render(
      <FreeBusyList
        freeWindows={[FIXTURE_FREE]}
        busyWindows={[]}
        isLoading={false}
        isError={false}
        calendarLabel='Work Calendar'
      />
    );
    expect(screen.getByText('Free/busy for Work Calendar')).toBeInTheDocument();
  });

  it('does not render a heading when calendarLabel is omitted', () => {
    render(
      <FreeBusyList
        freeWindows={[FIXTURE_FREE]}
        busyWindows={[]}
        isLoading={false}
        isError={false}
      />
    );
    expect(screen.queryByText(/Free\/busy for/)).not.toBeInTheDocument();
  });

  // ---- Empty state ---------------------------------------------------------

  it('shows empty state when no windows are provided', () => {
    render(
      <FreeBusyList
        freeWindows={[]}
        busyWindows={[]}
        isLoading={false}
        isError={false}
      />
    );
    expect(
      screen.getByText(/no availability windows found/i)
    ).toBeInTheDocument();
  });

  // ---- Loading state -------------------------------------------------------

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <FreeBusyList
        freeWindows={[]}
        busyWindows={[]}
        isLoading={true}
        isError={false}
      />
    );
    // Skeletons are rendered — no empty state text
    expect(
      screen.queryByText(/no availability windows found/i)
    ).not.toBeInTheDocument();
    // Skeletons are divs with skeleton class
    expect(
      container.querySelectorAll('[class*="animate"]').length
    ).toBeGreaterThan(0);
  });

  // ---- Error state ---------------------------------------------------------

  it('shows error message when isError is true', () => {
    render(
      <FreeBusyList
        freeWindows={[]}
        busyWindows={[]}
        isLoading={false}
        isError={true}
      />
    );
    expect(
      screen.getByText(/failed to load availability/i)
    ).toBeInTheDocument();
  });
});
