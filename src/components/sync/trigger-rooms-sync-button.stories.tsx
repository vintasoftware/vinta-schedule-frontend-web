import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TriggerRoomsSyncButton } from './trigger-rooms-sync-button';

const meta = {
  component: TriggerRoomsSyncButton,
  title: 'Sync / Trigger Rooms Sync Button',
  tags: ['autodocs'],
} satisfies Meta<typeof TriggerRoomsSyncButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state: ready to trigger rooms sync.
 */
export const Default: Story = {};
