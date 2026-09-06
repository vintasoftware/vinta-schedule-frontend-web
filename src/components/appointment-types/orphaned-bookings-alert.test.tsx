/**
 * OrphanedBookingsAlert tests.
 *
 * Covers:
 * - one entry per booking, each with its title and formatted time;
 * - the copy states plainly that nothing was cancelled;
 * - clicking Dismiss removes the alert (and its bookings) from the DOM and
 *   calls the onDismiss callback;
 * - rendering with an empty list renders nothing -- a caller must gate on
 *   `bookings.length > 0` itself, but the component must not blow up (or
 *   silently render an empty shell) if it doesn't.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  OrphanedBookingsAlert,
  type OrphanedBooking,
} from './orphaned-bookings-alert';

function makeBooking(overrides: Partial<OrphanedBooking>): OrphanedBooking {
  return {
    id: 1,
    calendar_id: 42,
    title: 'Consult with Dr. Reyes',
    start_time: '2024-06-04T13:00:00Z',
    end_time: '2024-06-04T14:00:00Z',
    ...overrides,
  };
}

describe('OrphanedBookingsAlert', () => {
  it('renders one entry per booking with its title and formatted time', () => {
    const bookings = [
      makeBooking({ id: 1, title: 'Consult with Dr. Reyes' }),
      makeBooking({
        id: 2,
        title: 'Follow-up with Dr. Chen',
        start_time: '2024-06-06T15:30:00Z',
        end_time: '2024-06-06T16:00:00Z',
      }),
    ];

    render(<OrphanedBookingsAlert bookings={bookings} />);

    expect(screen.getByTestId('orphaned-booking-1')).toBeInTheDocument();
    expect(screen.getByTestId('orphaned-booking-2')).toBeInTheDocument();
    expect(screen.getByText('Consult with Dr. Reyes')).toBeInTheDocument();
    expect(screen.getByText('Follow-up with Dr. Chen')).toBeInTheDocument();
    // Formatted, not the raw ISO string -- proves the component actually
    // formats the time rather than dumping the wire value on screen (a
    // change that deleted the zonedFormat call would still pass a test that
    // only checked the ISO substring was present somewhere).
    expect(screen.getByText(/Jun 4, 2024, 1:00 PM/)).toBeInTheDocument();
    expect(screen.queryByText(/2024-06-04T13:00:00Z/)).not.toBeInTheDocument();
  });

  it('states plainly that nothing was cancelled', () => {
    render(<OrphanedBookingsAlert bookings={[makeBooking({})]} />);

    expect(screen.getByText(/nothing was cancelled/i)).toBeInTheDocument();
  });

  it('dismisses on click, removing the alert and calling onDismiss', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(
      <OrphanedBookingsAlert
        bookings={[makeBooking({})]}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByTestId('orphaned-bookings-alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(
      screen.queryByTestId('orphaned-bookings-alert')
    ).not.toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for an empty booking list', () => {
    const { container } = render(<OrphanedBookingsAlert bookings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
