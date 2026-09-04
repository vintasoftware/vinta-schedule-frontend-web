import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';

import { Calendar } from './calendar';

const meta = {
  title: 'Components/Calendar',
  component: Calendar,
  tags: ['autodocs'],
} satisfies Meta<typeof Calendar>;

export default meta;
// Typed as a bare `StoryObj`, not `StoryObj<typeof meta>` — `Calendar`'s
// props are a discriminated union keyed on `mode`, so a `meta.args` object
// can't carry a typed `onSelect` without widening back to the "no mode"
// branch (see DESIGN.md's Storybook conventions).
type Story = StoryObj;

function Controlled({
  disabled,
  defaultSelected,
}: {
  disabled?: (date: Date) => boolean;
  defaultSelected?: Date;
}) {
  const [selected, setSelected] = React.useState<Date | undefined>(
    defaultSelected
  );
  return (
    <Calendar
      mode='single'
      selected={selected}
      onSelect={setSelected}
      disabled={disabled}
    />
  );
}

export const Default: Story = {
  render: () => <Controlled />,
};

/** Only a fixed set of days is selectable — the shape the public booking
 * slot picker uses: every other day is disabled. */
export const OnlySomeDaysEnabled: Story = {
  render: () => {
    const today = new Date();
    const enabledDays = [0, 2, 5].map((offset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d;
    });
    return (
      <Controlled
        defaultSelected={enabledDays[0]}
        disabled={(date) =>
          !enabledDays.some(
            (enabled) => enabled.toDateString() === date.toDateString()
          )
        }
      />
    );
  },
};
