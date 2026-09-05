import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CodelessGroupNotFound } from './codeless-group-not-found';

const meta = {
  title: 'Components/PublicBooking/CodelessGroupNotFound',
  component: CodelessGroupNotFound,
  tags: ['autodocs'],
} satisfies Meta<typeof CodelessGroupNotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Rendered when `public_booking_slug` matches no group at all (a real
 * `404`). Distinct from `<CodelessGroupUnavailable />` — see that
 * component's story for the counterpart.
 */
export const Default: Story = {};
