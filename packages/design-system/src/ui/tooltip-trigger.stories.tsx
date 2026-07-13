import type { Meta, StoryObj } from '../story-types';

import { Tooltip, TooltipProvider, TooltipTrigger } from './tooltip';

/**
 * TooltipTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a tooltip trigger only means something inside a Tooltip.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose TooltipTrigger.
 */
const meta = {
  title: 'Components/TooltipTrigger',
  component: TooltipTrigger,
  tags: ['!dev'],
  argTypes: {
    asChild: {
      control: 'boolean',
      description:
        'Merge props onto the single child element instead of rendering a button',
    },
  },
  args: { asChild: false },
  // The trigger can hold any content (icon, text, custom element).
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof TooltipTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>Hover me</TooltipTrigger>
      </Tooltip>
    </TooltipProvider>
  ),
};
