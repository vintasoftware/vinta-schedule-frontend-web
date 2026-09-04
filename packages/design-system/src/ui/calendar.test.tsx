import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { Calendar } from './calendar';

describe('Calendar', () => {
  it('marks days matched by `disabled` as disabled and does not call onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const month = new Date(2026, 2, 1); // March 2026

    render(
      <Calendar
        mode='single'
        defaultMonth={month}
        selected={undefined}
        onSelect={onSelect}
        // Every day is disabled except the 15th.
        disabled={(date) => date.getDate() !== 15}
      />
    );

    // The day button's accessible name is the full formatted date (react-day-picker's
    // `labelDayButton` default, e.g. "Saturday, March 14th, 2026"), not the bare day number.
    const disabledDay = screen.getByRole('button', {
      name: /March 14th, 2026/,
    });
    expect(disabledDay).toBeDisabled();

    await user.click(disabledDay);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect with the correct Date for a non-disabled day', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const month = new Date(2026, 2, 1); // March 2026 (0-indexed month)

    render(
      <Calendar
        mode='single'
        defaultMonth={month}
        selected={undefined}
        onSelect={onSelect}
      />
    );

    const day10 = screen.getByRole('button', { name: /March 10th, 2026/ });
    await user.click(day10);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0][0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(2);
    expect(selected.getDate()).toBe(10);
  });

  it('changes the month_caption text when navigating via previous/next', async () => {
    const user = userEvent.setup();
    const month = new Date(2026, 2, 1); // March 2026

    render(
      <Calendar
        mode='single'
        defaultMonth={month}
        selected={undefined}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText(/March 2026/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next month/i }));
    expect(screen.getByText(/April 2026/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText(/March 2026/)).toBeInTheDocument();
  });

  it('marks the selected day with data-selected-single', () => {
    const month = new Date(2026, 2, 1);
    const selected = new Date(2026, 2, 10);

    render(
      <Calendar
        mode='single'
        defaultMonth={month}
        selected={selected}
        onSelect={vi.fn()}
      />
    );

    const selectedDay = screen.getByRole('button', {
      name: /March 10th, 2026/,
    });
    expect(selectedDay).toHaveAttribute('data-selected-single', 'true');

    const unselectedDay = screen.getByRole('button', {
      name: /March 11th, 2026/,
    });
    expect(unselectedDay).not.toHaveAttribute('data-selected-single', 'true');
  });
});
