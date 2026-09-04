/**
 * GroupSlotSelection tests.
 *
 * Covers (per the phase spec):
 * - A satisfiable group completes and calls `onSubmit` with the right
 *   `slot_selections` (`[{ slot_id, calendar_ids }]`).
 * - An unsatisfiable slot hard-blocks the Continue button.
 * - A busy candidate (present in the slot's pool but not in its free set)
 *   is not selectable (checkbox disabled, clicking it is a no-op).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import * as React from 'react';
import type { SlotViewModel } from '@/lib/booking-links/group-selection';
import { GroupSlotSelection } from './group-slot-selection';

/**
 * `GroupSlotSelection` is a controlled component (selection state lives in
 * the parent) — this wraps it with real `useState` so a click's `onToggle`
 * actually updates what's rendered, exercising the component the way its
 * real flow parent (`public-group-booking-flow.tsx`) does.
 */
function StatefulHarness({
  slots,
  onSubmit,
}: {
  slots: SlotViewModel[];
  onSubmit: (
    slotSelections: { slot_id: number; calendar_ids: number[] }[]
  ) => void;
}) {
  const [selection, setSelection] = React.useState<Record<number, number[]>>(
    {}
  );
  return (
    <GroupSlotSelection
      slots={slots}
      selection={selection}
      onToggle={(slotId, calendarId) =>
        setSelection((prev) => {
          const current = prev[slotId] ?? [];
          return current.includes(calendarId)
            ? { ...prev, [slotId]: current.filter((id) => id !== calendarId) }
            : { ...prev, [slotId]: [...current, calendarId] };
        })
      }
      onSubmit={onSubmit}
    />
  );
}

/** One slot, pool == available (the public API discloses no busier pool). */
const SATISFIABLE_SLOT: SlotViewModel = {
  slotId: 1,
  name: 'Slot 1',
  requiredCount: 1,
  pool: [{ id: 10, name: 'Option 1' }],
  availableCalendarIds: [10],
};

/** A slot with a candidate in its pool that is NOT free — "busy". */
function slotWithBusyCandidate(): SlotViewModel {
  return {
    slotId: 2,
    name: 'Slot 2',
    requiredCount: 1,
    pool: [
      { id: 20, name: 'Option 1' },
      { id: 21, name: 'Option 2' },
    ],
    availableCalendarIds: [20], // 21 is in the pool but not free — busy
  };
}

/** A slot that cannot be satisfied: needs 2, only 1 free. */
function unsatisfiableSlot(): SlotViewModel {
  return {
    slotId: 3,
    name: 'Slot 3',
    requiredCount: 2,
    pool: [{ id: 30, name: 'Option 1' }],
    availableCalendarIds: [30],
  };
}

describe('GroupSlotSelection', () => {
  it('a satisfiable group completes and submits the right slot_selections', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<StatefulHarness slots={[SATISFIABLE_SLOT]} onSubmit={onSubmit} />);

    // Continue is disabled until the required candidate is selected.
    expect(screen.getByTestId('group-slot-selection-continue')).toBeDisabled();

    await user.click(screen.getByTestId('group-slot-1-option-10'));

    expect(screen.getByTestId('group-slot-selection-continue')).toBeEnabled();
    await user.click(screen.getByTestId('group-slot-selection-continue'));

    expect(onSubmit).toHaveBeenCalledWith([{ slot_id: 1, calendar_ids: [10] }]);
  });

  it('an unsatisfiable slot hard-blocks submit even with a complete-looking selection elsewhere', () => {
    const onSubmit = vi.fn();

    render(
      <GroupSlotSelection
        slots={[SATISFIABLE_SLOT, unsatisfiableSlot()]}
        selection={{ 1: [10] }}
        onToggle={() => {}}
        onSubmit={onSubmit}
      />
    );

    expect(
      screen.getByTestId('group-slot-3-unsatisfiable')
    ).toBeInTheDocument();
    expect(screen.getByTestId('group-slot-selection-continue')).toBeDisabled();
  });

  it('a busy candidate is not selectable', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <GroupSlotSelection
        slots={[slotWithBusyCandidate()]}
        selection={{}}
        onToggle={onToggle}
        onSubmit={vi.fn()}
      />
    );

    const busyCheckbox = screen.getByTestId('group-slot-2-option-21');
    expect(busyCheckbox).toBeDisabled();

    await user.click(busyCheckbox);
    expect(onToggle).not.toHaveBeenCalled();

    // The free candidate in the same slot remains selectable.
    const freeCheckbox = screen.getByTestId('group-slot-2-option-20');
    expect(freeCheckbox).not.toBeDisabled();
    await user.click(freeCheckbox);
    expect(onToggle).toHaveBeenCalledWith(2, 20);
  });
});
