import type { Meta, StoryObj } from '../story-types';

import { Sheet, SheetTrigger } from './sheet';

/**
 * SheetTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet trigger only means something inside a Sheet.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetTrigger.
 */
const meta = {
  title: 'Components/SheetTrigger',
  component: SheetTrigger,
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
} satisfies Meta<typeof SheetTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger>Open details</SheetTrigger>
    </Sheet>
  ),
};
