/**
 * SlotPicker unit tests.
 *
 * The flow-level tests (`public-booking-flow.test.tsx` etc.) only ever pass a
 * single proposal per fixture, which auto-selects its one day and never
 * exercises the day grid, the per-day time swap, the disabled-day predicate,
 * month navigation, the timezone day-boundary grouping, or the
 * `key={availableDayKeys.join('|')}` remount-on-changed-day-set behavior.
 * This file covers those directly.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { BookableSlotProposal } from '@/client';
import { SlotPicker, proposalKey } from './slot-picker';

// ---------------------------------------------------------------------------
// jsdom polyfills Radix's RadioGroup needs (same as public-booking-flow.test.tsx).
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

// ---------------------------------------------------------------------------
// Harness — SlotPicker is a controlled component; wrap it with real state so
// clicking a radio actually updates `selectedSlot`, the way every real caller
// (`public-booking-flow.tsx` et al.) does.
// ---------------------------------------------------------------------------
function SelectionHarness({
  proposals,
  timezone = 'UTC',
}: {
  proposals: BookableSlotProposal[];
  timezone?: string;
}) {
  const [selected, setSelected] = React.useState<BookableSlotProposal | null>(
    null
  );
  return (
    <SlotPicker
      proposals={proposals}
      timezone={timezone}
      selectedSlot={selected}
      onSelect={setSelected}
    />
  );
}

/** Buttons inside the day grid, excluding the previous/next nav buttons. */
function dayButtons(calendar: HTMLElement) {
  return within(calendar)
    .getAllByRole('button')
    .filter(
      (btn) => !(btn.getAttribute('aria-label') ?? '').startsWith('Go to the')
    );
}

function enabledDayButtons(calendar: HTMLElement) {
  return dayButtons(calendar).filter(
    (btn) => !(btn as HTMLButtonElement).disabled
  );
}

describe('SlotPicker', () => {
  it('appointment types proposals by day, auto-selects the first day, and only that day has an enabled cell alongside the other day with proposals', async () => {
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-10T09:00:00.000Z',
        end_time: '2026-03-10T09:30:00.000Z',
      },
      {
        start_time: '2026-03-10T10:00:00.000Z',
        end_time: '2026-03-10T10:30:00.000Z',
      },
      {
        start_time: '2026-03-12T14:00:00.000Z',
        end_time: '2026-03-12T14:30:00.000Z',
      },
    ];

    render(<SelectionHarness proposals={proposals} />);

    // Day A (the 10th, earliest) auto-selected — its two times render.
    expect(
      screen.getByText('Available times for Mar 10, 2026')
    ).toBeInTheDocument();
    expect(screen.getByText('9:00 AM')).toBeInTheDocument();
    expect(screen.getByText('10:00 AM')).toBeInTheDocument();
    // Day B's time is not shown yet.
    expect(screen.queryByText('2:00 PM')).not.toBeInTheDocument();

    // Exactly two selectable day cells in the grid: the 10th and the 12th.
    const calendar = screen.getByTestId('slot-picker-calendar');
    expect(enabledDayButtons(calendar)).toHaveLength(2);
  });

  it('selecting day B swaps the time list and updates the day label', async () => {
    const user = userEvent.setup();
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-10T09:00:00.000Z',
        end_time: '2026-03-10T09:30:00.000Z',
      },
      {
        start_time: '2026-03-12T14:00:00.000Z',
        end_time: '2026-03-12T14:30:00.000Z',
      },
    ];

    render(<SelectionHarness proposals={proposals} />);

    const calendar = screen.getByTestId('slot-picker-calendar');
    const dayB = within(calendar).getByRole('button', {
      name: /March 12th, 2026/,
    });
    await user.click(dayB);

    expect(
      screen.getByText('Available times for Mar 12, 2026')
    ).toBeInTheDocument();
    expect(screen.queryByText('9:00 AM')).not.toBeInTheDocument();
    expect(screen.getByText('2:00 PM')).toBeInTheDocument();
  });

  it('a day without a proposal is disabled and clicking it does not change the selection', async () => {
    const user = userEvent.setup();
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-10T09:00:00.000Z',
        end_time: '2026-03-10T09:30:00.000Z',
      },
    ];

    render(<SelectionHarness proposals={proposals} />);

    const calendar = screen.getByTestId('slot-picker-calendar');
    // The 15th has no proposal, and is in the same visible month.
    const emptyDay = within(calendar).getByRole('button', {
      name: /March 15th, 2026/,
    });
    expect(emptyDay).toBeDisabled();

    await user.click(emptyDay);

    // Selection is untouched — still day A's time.
    expect(
      screen.getByText('Available times for Mar 10, 2026')
    ).toBeInTheDocument();
  });

  it('navigating to the next month reaches a selectable day there', async () => {
    const user = userEvent.setup();
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-05T09:00:00.000Z',
        end_time: '2026-03-05T09:30:00.000Z',
      },
      {
        start_time: '2026-04-02T11:00:00.000Z',
        end_time: '2026-04-02T11:30:00.000Z',
      },
    ];

    render(<SelectionHarness proposals={proposals} />);

    expect(screen.getByText('March 2026')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /Go to the Next Month/i })
    );
    expect(screen.getByText('April 2026')).toBeInTheDocument();

    const calendar = screen.getByTestId('slot-picker-calendar');
    const aprilDay = within(calendar).getByRole('button', {
      name: /April 2nd, 2026/,
    });
    expect(aprilDay).not.toBeDisabled();

    await user.click(aprilDay);
    expect(
      screen.getByText('Available times for Apr 2, 2026')
    ).toBeInTheDocument();
  });

  it('appointment types a proposal into the NEXT day when the zone is far enough ahead of UTC', () => {
    // 23:30 UTC on the 2nd is 13:30 on the 3rd in Pacific/Kiritimati (UTC+14).
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-02T23:30:00.000Z',
        end_time: '2026-03-02T23:45:00.000Z',
      },
    ];

    render(
      <SelectionHarness proposals={proposals} timezone='Pacific/Kiritimati' />
    );

    expect(
      screen.getByText('Available times for Mar 3, 2026')
    ).toBeInTheDocument();
  });

  it('appointment types a proposal into the PREVIOUS day when the zone is far enough behind UTC', () => {
    // 02:00 UTC on the 2nd is 18:00 on the 1st in America/Los_Angeles (UTC-8).
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-02T02:00:00.000Z',
        end_time: '2026-03-02T02:30:00.000Z',
      },
    ];

    render(
      <SelectionHarness proposals={proposals} timezone='America/Los_Angeles' />
    );

    expect(
      screen.getByText('Available times for Mar 1, 2026')
    ).toBeInTheDocument();
  });

  it("resets the selected day to the new set's first day when the whole day set changes (SLOT_UNAVAILABLE refetch)", async () => {
    const user = userEvent.setup();
    const dayAOnly: BookableSlotProposal[] = [
      {
        start_time: '2026-03-05T09:00:00.000Z',
        end_time: '2026-03-05T09:30:00.000Z',
      },
    ];
    const dayCOnly: BookableSlotProposal[] = [
      {
        start_time: '2026-03-20T11:00:00.000Z',
        end_time: '2026-03-20T11:30:00.000Z',
      },
    ];

    const { rerender } = render(<SelectionHarness proposals={dayAOnly} />);

    const radio = await screen.findByRole('radio');
    await user.click(radio);
    expect(
      screen.getByText('Available times for Mar 5, 2026')
    ).toBeInTheDocument();

    // An entirely different day set — e.g. a SLOT_UNAVAILABLE retry refetching
    // a different window. The `key={availableDayKeys.join('|')}` on
    // `SlotPickerCalendar` must remount it so its internal `selectedDay`
    // state re-derives from the new set instead of staying stuck on the 5th.
    rerender(<SelectionHarness proposals={dayCOnly} />);

    expect(
      await screen.findByText('Available times for Mar 20, 2026')
    ).toBeInTheDocument();
  });

  it('selecting the SECOND proposal in a day reports that exact proposal, not the first', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const first: BookableSlotProposal = {
      start_time: '2026-03-10T09:00:00.000Z',
      end_time: '2026-03-10T09:30:00.000Z',
    };
    const second: BookableSlotProposal = {
      start_time: '2026-03-10T10:00:00.000Z',
      end_time: '2026-03-10T10:30:00.000Z',
    };

    render(
      <SlotPicker
        proposals={[first, second]}
        timezone='UTC'
        selectedSlot={null}
        onSelect={onSelect}
      />
    );

    const radios = await screen.findAllByRole('radio');
    expect(radios).toHaveLength(2);
    await user.click(radios[1]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(second);
    expect(onSelect).not.toHaveBeenCalledWith(first);
  });

  // ---------------------------------------------------------------------
  // `uniformDurationMinutes`'s "never lie" contract — see the module doc
  // comment. These exercise it through the rendered UI rather than calling
  // the function directly, so a regression in the WIRING (not just the pure
  // helper) is caught too.
  // ---------------------------------------------------------------------

  it('renders each row’s OWN minutes, and no consolidated line, for a day with two different-length proposals', async () => {
    const shorter: BookableSlotProposal = {
      start_time: '2026-03-10T09:00:00.000Z',
      end_time: '2026-03-10T09:30:00.000Z', // 30 min
    };
    const longer: BookableSlotProposal = {
      start_time: '2026-03-10T10:00:00.000Z',
      end_time: '2026-03-10T10:45:00.000Z', // 45 min
    };

    render(<SelectionHarness proposals={[shorter, longer]} />);

    // Regression guard: if `uniformDurationMinutes` (or its wiring) ever
    // consolidates unconditionally, the per-row minutes below stop
    // rendering (they're gated on `dayUniformMinutes === null`) and this
    // assertion fails.
    expect(
      within(
        screen.getByTestId(`slot-option-${proposalKey(shorter)}`)
      ).getByText('30 min')
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId(`slot-option-${proposalKey(longer)}`)
      ).getByText('45 min')
    ).toBeInTheDocument();
    expect(screen.queryByText(/min each/)).not.toBeInTheDocument();
  });

  it('renders one consolidated line, and no per-row minutes, for a day with uniform-length proposals', async () => {
    const first: BookableSlotProposal = {
      start_time: '2026-03-10T09:00:00.000Z',
      end_time: '2026-03-10T09:30:00.000Z', // 30 min
    };
    const second: BookableSlotProposal = {
      start_time: '2026-03-10T10:00:00.000Z',
      end_time: '2026-03-10T10:30:00.000Z', // 30 min
    };

    render(<SelectionHarness proposals={[first, second]} />);

    expect(screen.getByText('30 min each')).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId(`slot-option-${proposalKey(first)}`)
      ).queryByText('30 min')
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByTestId(`slot-option-${proposalKey(second)}`)
      ).queryByText('30 min')
    ).not.toBeInTheDocument();
  });

  it('fires onTimezoneChange with the selected zone when the timezone combobox is used', async () => {
    const user = userEvent.setup();
    const onTimezoneChange = vi.fn();
    const proposals: BookableSlotProposal[] = [
      {
        start_time: '2026-03-10T09:00:00.000Z',
        end_time: '2026-03-10T09:30:00.000Z',
      },
    ];

    render(
      <SlotPicker
        proposals={proposals}
        timezone='UTC'
        selectedSlot={null}
        onSelect={vi.fn()}
        onTimezoneChange={onTimezoneChange}
      />
    );

    const trigger = screen.getByRole('combobox', { name: 'Change timezone' });
    await user.click(trigger);
    await user.click(
      await screen.findByRole('option', { name: 'America/Denver' })
    );

    expect(onTimezoneChange).toHaveBeenCalledTimes(1);
    expect(onTimezoneChange).toHaveBeenCalledWith('America/Denver');
  });
});
