import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CodelessGroupUnavailable } from './codeless-group-unavailable';

const meta = {
  title: 'Components/PublicBooking/CodelessGroupUnavailable',
  component: CodelessGroupUnavailable,
  tags: ['autodocs'],
} satisfies Meta<typeof CodelessGroupUnavailable>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Rendered when `public_booking_slug` resolves to a real group this route
 * isn't open to — private, or public with no usable duration (a real
 * `403`). Distinct from `<CodelessGroupNotFound />` — see that component's
 * story for the counterpart.
 */
export const Default: Story = {};
