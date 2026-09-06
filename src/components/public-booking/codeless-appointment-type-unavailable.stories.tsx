import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CodelessAppointmentTypeUnavailable } from './codeless-appointment-type-unavailable';

const meta = {
  title: 'Components/PublicBooking/CodelessAppointmentTypeUnavailable',
  component: CodelessAppointmentTypeUnavailable,
  tags: ['autodocs'],
} satisfies Meta<typeof CodelessAppointmentTypeUnavailable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Rendered when `public_booking_slug` resolves to a real appointment type this route
 * isn't open to — private, or public with no usable duration (a real
 * `403`). Distinct from `<CodelessAppointmentTypeNotFound />` — see that component's
 * story for the counterpart.
 */
export const Default: Story = {};
