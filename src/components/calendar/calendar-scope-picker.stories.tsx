'use client';

/**
 * Storybook stories for CalendarScopePicker.
 *
 * Covers the three key visual states:
 *   - Empty (no calendars available)
 *   - Populated (multiple calendars, one selected)
 *   - Disabled (picker rendered but not interactive)
 */

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarScopePicker } from './calendar-scope-picker';
import { VStack } from '@vinta-schedule/design-system/layout';

// ---------------------------------------------------------------------------
// Fixture calendars
// ---------------------------------------------------------------------------

const SAMPLE_CALENDARS = [
  { id: 1, name: 'Personal' },
  { id: 2, name: 'Work' },
  { id: 3, name: 'Shared — Design Team' },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof CalendarScopePicker> = {
  title: 'Calendar/CalendarScopePicker',
  component: CalendarScopePicker,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <VStack gap={4} className='max-w-sm p-4'>
        <Story />
      </VStack>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CalendarScopePicker>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** No calendars loaded yet — shows "All calendars" as the only option. */
export const Empty: Story = {
  args: {
    calendars: [],
    value: null,
    onChange: () => {},
  },
};

/** Multiple calendars available; one is currently selected. */
export const Populated: Story = {
  render: function PopulatedStory() {
    const [selected, setSelected] = React.useState<number | null>(2);
    return (
      <CalendarScopePicker
        calendars={SAMPLE_CALENDARS}
        value={selected}
        onChange={setSelected}
      />
    );
  },
};

/** All-calendars selection (null value). */
export const AllCalendarsSelected: Story = {
  render: function AllSelectedStory() {
    const [selected, setSelected] = React.useState<number | null>(null);
    return (
      <CalendarScopePicker
        calendars={SAMPLE_CALENDARS}
        value={selected}
        onChange={setSelected}
      />
    );
  },
};

/** Disabled state — picker is rendered but not interactive. */
export const Disabled: Story = {
  args: {
    calendars: SAMPLE_CALENDARS,
    value: 1,
    onChange: () => {},
    disabled: true,
  },
};
