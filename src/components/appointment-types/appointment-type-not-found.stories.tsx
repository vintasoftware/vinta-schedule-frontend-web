import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AppointmentTypeNotFound } from './appointment-type-not-found';

const meta = {
  title: 'Components/AppointmentTypes/AppointmentTypeNotFound',
  component: AppointmentTypeNotFound,
  tags: ['autodocs'],
} satisfies Meta<typeof AppointmentTypeNotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

// One rendered state, on purpose — the whole point is that a missing appointment type,
// an other-organization appointment type, an out-of-scope appointment type, and an unauthorized
// caller all land on this exact screen.
export const Default: Story = {};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
