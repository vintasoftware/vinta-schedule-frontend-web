import type { Meta, StoryObj } from '../story-types';

import { Drawer, DrawerClose, DrawerContent, DrawerFooter } from './drawer';
import { Button } from './button';

/**
 * DrawerFooter — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer footer only means something inside DrawerContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerFooter.
 */
const meta = {
  title: 'Components/DrawerFooter',
  component: DrawerFooter,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DrawerFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer defaultOpen>
      <DrawerContent>
        <DrawerFooter>
          <Button>Confirm</Button>
          <DrawerClose asChild>
            <Button variant='outline'>Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
