import type { Meta, StoryObj } from '../story-types';

import { Sheet, SheetClose, SheetContent, SheetFooter } from './sheet';
import { Button } from './button';

/**
 * SheetFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sheet footer only means something inside SheetContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose SheetFooter.
 */
const meta = {
  title: 'Components/SheetFooter',
  component: SheetFooter,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof SheetFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetContent>
        <SheetFooter>
          <SheetClose asChild>
            <Button>Done</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};
