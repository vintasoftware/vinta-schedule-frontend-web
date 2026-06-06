import type { Meta, StoryObj } from '@storybook/react';
import { TriggerOrgCalendarSyncButton } from './trigger-org-calendar-sync-button';

const meta = {
  component: TriggerOrgCalendarSyncButton,
  title: 'Sync / Trigger Org Calendar Sync Button',
  tags: ['autodocs'],
} satisfies Meta<typeof TriggerOrgCalendarSyncButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state: ready to trigger org-wide calendar sync.
 */
export const Default: Story = {};
