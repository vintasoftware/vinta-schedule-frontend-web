/**
 * ConflictSurface tests.
 *
 * Covers:
 * - Renders the conflicting calendar name
 * - Renders the reason and time of the conflicting window
 * - Renders the nearest free window when present
 * - The "Book anyway" button fires the onProceed callback
 * - The "Adjust time" button fires the onAdjust callback
 * - Does NOT hard-block — "Book anyway" is always present
 * - isPending disables both buttons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ConflictSurface, type CalendarConflict } from './conflict-surface';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CONFLICT_SINGLE: CalendarConflict = {
  calendarId: 1,
  calendarName: 'Personal Calendar',
  conflictingWindows: [
    {
      id: 10,
      reason: 'blocked_time',
      reason_description: 'Existing blocked time',
      start_time: '2024-06-15T09:00:00-04:00',
      end_time: '2024-06-15T10:00:00-04:00',
    },
  ],
  nearestFreeWindow: {
    id: 20,
    start_time: '2024-06-15T11:00:00-04:00',
    end_time: '2024-06-15T12:00:00-04:00',
    can_book_partially: false,
  },
};

const FIXTURE_CONFLICT_NO_FREE_WINDOW: CalendarConflict = {
  calendarId: 2,
  calendarName: 'Work Calendar',
  conflictingWindows: [
    {
      id: 11,
      reason: 'calendar_event',
      reason_description: 'Team standup',
      start_time: '2024-06-15T14:00:00-04:00',
      end_time: '2024-06-15T15:00:00-04:00',
    },
  ],
  nearestFreeWindow: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConflictSurface', () => {
  const onProceed = vi.fn();
  const onAdjust = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the conflicting calendar name', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
    });

    it('renders the conflict reason from reason_description', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(screen.getByText(/Existing blocked time/)).toBeInTheDocument();
    });

    it('renders the nearest free window when present', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(screen.getByTestId('nearest-free-window')).toBeInTheDocument();
    });

    it('does not render nearest free window when it is null', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_NO_FREE_WINDOW]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(
        screen.queryByTestId('nearest-free-window')
      ).not.toBeInTheDocument();
    });

    it('renders multiple calendar conflicts', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE, FIXTURE_CONFLICT_NO_FREE_WINDOW]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      expect(screen.getByText('Work Calendar')).toBeInTheDocument();
      expect(screen.getAllByTestId('conflict-item')).toHaveLength(2);
    });

    it('renders the conflict-surface container', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(screen.getByTestId('conflict-surface')).toBeInTheDocument();
    });
  });

  describe('warn-but-allow-override (never hard-blocks)', () => {
    it('renders the "Book anyway" button', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(
        screen.getByRole('button', { name: /book anyway/i })
      ).toBeInTheDocument();
    });

    it('renders the "Adjust time" button', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      expect(
        screen.getByRole('button', { name: /adjust time/i })
      ).toBeInTheDocument();
    });

    it('Book anyway is enabled (not hard-blocked) by default', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );
      const bookAnyway = screen.getByRole('button', { name: /book anyway/i });
      expect(bookAnyway).not.toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('calls onProceed when "Book anyway" is clicked', async () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );

      await userEvent.click(
        screen.getByRole('button', { name: /book anyway/i })
      );

      expect(onProceed).toHaveBeenCalledOnce();
      expect(onAdjust).not.toHaveBeenCalled();
    });

    it('calls onAdjust when "Adjust time" is clicked', async () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
        />
      );

      await userEvent.click(
        screen.getByRole('button', { name: /adjust time/i })
      );

      expect(onAdjust).toHaveBeenCalledOnce();
      expect(onProceed).not.toHaveBeenCalled();
    });
  });

  describe('isPending state', () => {
    it('disables both buttons when isPending=true', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
          isPending={true}
        />
      );
      expect(
        screen.getByRole('button', { name: /adjust time/i })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: /booking…/i })).toBeDisabled();
    });

    it('shows "Booking…" label on the proceed button when isPending=true', () => {
      render(
        <ConflictSurface
          conflicts={[FIXTURE_CONFLICT_SINGLE]}
          onProceed={onProceed}
          onAdjust={onAdjust}
          isPending={true}
        />
      );
      expect(
        screen.getByRole('button', { name: /booking…/i })
      ).toBeInTheDocument();
    });
  });
});
