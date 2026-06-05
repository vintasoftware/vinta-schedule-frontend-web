import type { StoryObj } from '@storybook/react';
import { CreateGroupDialog } from './create-group-dialog';

const meta = {
  title: 'Components / Calendar Groups / CreateGroupDialog',
  component: CreateGroupDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
