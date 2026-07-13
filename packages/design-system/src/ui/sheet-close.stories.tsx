import type { Meta, StoryObj } from '../story-types';

import { Sheet, SheetClose, SheetContent } from './sheet';
import { Button } from './button';

/**
 * SheetClose — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet close control only means something inside a Sheet.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetClose.
 */
const meta = {
  title: 'Components/SheetClose',
  component: SheetClose,
  tags: ['!dev'],
  argTypes: {
    asChild: {
      control: 'boolean',
      description:
        'Merge props onto the single child element instead of rendering a button',
    },
  },
  args: { asChild: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof SheetClose>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetClose asChild>
          <Button>Done</Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  ),
};
