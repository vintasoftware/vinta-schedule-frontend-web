import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OverLimitAlert } from './over-limit-alert';

// No GroupPermissionsProvider wrapper -- this component reads no
// permission context (same precedent as group-not-found.stories.tsx).
const meta = {
  title: 'Components/CalendarGroups/OverLimitAlert',
  component: OverLimitAlert,
  tags: ['autodocs'],
} satisfies Meta<typeof OverLimitAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

// `error` is required -- there's no rendered-nothing state to show here the
// way OrphanedBookingsAlert has for an empty booking list. Every story renders
// the upgrade deep-link into the billing plan picker (carrying the offending
// `resource`); the stories below cover the alert's two copy branches: the
// rejected write was the only thing attempted, vs. other writes in the same
// batch already landed (see the module doc comment on `otherWritesSucceeded`).
export const Default: Story = {
  args: {
    error: {
      code: 'limit_exceeded',
      resource: 'availability_windows',
      current_usage: 50,
      limit: 50,
      detail: 'Organization is at its limit for availability windows.',
    },
  },
};

export const WithOtherWritesInTheSameSaveAlreadySucceeded: Story = {
  name: 'With other writes in the same save already succeeded',
  args: {
    ...Default.args,
    otherWritesSucceeded: 2,
  },
};

export const Mobile: Story = {
  ...Default,
  globals: { viewport: { value: 'mobile' } },
};
