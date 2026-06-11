import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScopePromptDialog } from './scope-prompt-dialog';

const meta = {
  title: 'Bookings/ScopePromptDialog',
  component: ScopePromptDialog,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    actionLabel: {
      control: 'select',
      options: ['Cancel', 'Reschedule', 'Edit', 'Apply'],
    },
  },
} satisfies Meta<typeof ScopePromptDialog>;

export default meta;
type Story = StoryObj;

export const CancelAction: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    eventTitle: 'Weekly Team Standup',
    onSelect: () => {},
    actionLabel: 'Cancel',
  },
};

export const EditAction: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    eventTitle: 'Monthly Planning Meeting',
    onSelect: () => {},
    actionLabel: 'Edit',
  },
};

export const RescheduleAction: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    eventTitle: 'Project Review',
    onSelect: () => {},
    actionLabel: 'Reschedule',
  },
};
