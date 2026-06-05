import type { StoryObj } from '@storybook/react';
import { NewTokenDialog } from './new-token-dialog';

const meta = {
  title: 'Components / API Tokens / NewTokenDialog',
  component: NewTokenDialog,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
  },
};
