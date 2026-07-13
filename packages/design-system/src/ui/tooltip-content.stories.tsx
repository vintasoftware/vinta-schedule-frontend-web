import type { Meta, StoryObj } from '../story-types';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';
import { Button } from './button';

/**
 * TooltipContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: tooltip content only means something inside a Tooltip.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose TooltipContent.
 */
const meta = {
  title: 'Components/TooltipContent',
  component: TooltipContent,
  tags: ['!dev'],
  argTypes: {
    side: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Preferred side to render against the trigger',
    },
    sideOffset: {
      control: 'number',
      description: 'Distance in pixels from the trigger',
    },
  },
  args: { side: 'top', sideOffset: 4 },
  // Holds the tooltip's message content (usually text, occasionally markup).
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof TooltipContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant='outline'>Hover me</Button>
        </TooltipTrigger>
        <TooltipContent side='top' sideOffset={4}>
          Syncs every 5 minutes
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
};
