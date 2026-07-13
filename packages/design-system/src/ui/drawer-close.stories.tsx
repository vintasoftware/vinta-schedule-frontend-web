import type { Meta, StoryObj } from '../story-types';

import { Drawer, DrawerClose, DrawerContent } from './drawer';
import { Button } from './button';

/**
 * DrawerClose — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer close control only means something inside a Drawer.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerClose.
 */
const meta = {
  title: 'Components/DrawerClose',
  component: DrawerClose,
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
} satisfies Meta<typeof DrawerClose>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer defaultOpen>
      <DrawerContent>
        <DrawerClose asChild>
          <Button variant='outline'>Cancel</Button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  ),
};
