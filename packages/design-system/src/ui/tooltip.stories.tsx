import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { Button } from './button';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open on mount (uncontrolled)',
    },
    delayDuration: {
      control: 'number',
      description: 'ms from pointer enter until the tooltip opens',
    },
    disableHoverableContent: { control: 'boolean' },
  },
  args: { defaultOpen: false, delayDuration: 700 },
  // A tooltip's children are its trigger and its content — nothing else.
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <TooltipProvider>
      <Tooltip {...args}>
        <TooltipTrigger asChild>
          <Button variant='outline'>Hover me</Button>
        </TooltipTrigger>
        <TooltipContent>Syncs every 5 minutes</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
