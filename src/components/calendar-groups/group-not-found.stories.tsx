import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { GroupNotFound } from './group-not-found';

const meta = {
  title: 'Components/CalendarGroups/GroupNotFound',
  component: GroupNotFound,
  tags: ['autodocs'],
} satisfies Meta<typeof GroupNotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

// One rendered state, on purpose — the whole point is that a missing group,
// an other-organization group, an out-of-scope group, and an unauthorized
// caller all land on this exact screen.
export const Default: Story = {};

export const Mobile: Story = {
  globals: { viewport: { value: 'mobile' } },
};
