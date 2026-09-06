import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CodelessAppointmentTypeNotFound } from './codeless-appointment-type-not-found';

const meta = {
  title: 'Components/PublicBooking/CodelessAppointmentTypeNotFound',
  component: CodelessAppointmentTypeNotFound,
  tags: ['autodocs'],
} satisfies Meta<typeof CodelessAppointmentTypeNotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Rendered when `public_booking_slug` matches no appointment type at all (a real
 * `404`). Distinct from `<CodelessAppointmentTypeUnavailable />` — see that
 * component's story for the counterpart.
 */
export const Default: Story = {};
