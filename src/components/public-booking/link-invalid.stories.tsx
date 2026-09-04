import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LinkInvalid } from './link-invalid';

const meta = {
  title: 'Components/PublicBooking/LinkInvalid',
  component: LinkInvalid,
  tags: ['autodocs'],
} satisfies Meta<typeof LinkInvalid>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The ONE state rendered for every code-gated read failure — invalid,
 * expired, used, revoked, wrong-scope. There is deliberately no prop to
 * pass a more specific reason; see the component's doc comment.
 */
export const Default: Story = {};
