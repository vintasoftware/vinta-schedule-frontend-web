import type { Meta, StoryObj } from '../story-types';

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
  // Radix TooltipProps (the Root): `open`/`defaultOpen`/`delayDuration`/
  // `disableHoverableContent`. `side`/`sideOffset` live on TooltipContent, not
  // the root, so they are not curated here. Trigger + content are `children` →
  // slot (§4), never also an argType (§5).
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
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['TooltipTrigger', 'TooltipContent'] },
      ],
    },
  },
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
