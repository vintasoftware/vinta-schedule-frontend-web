import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { AttendeeForm } from './attendee-form';

const meta = {
  title: 'Components/PublicBooking/AttendeeForm',
  component: AttendeeForm,
  tags: ['autodocs'],
  args: {
    defaultTimezone: 'America/New_York',
    isSubmitting: false,
    onSubmit: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof AttendeeForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Submitting: Story = {
  args: { isSubmitting: true },
};

/** No `onBack` — the "Back" button is hidden entirely. */
export const NoBackAction: Story = {
  args: { onBack: undefined },
};
