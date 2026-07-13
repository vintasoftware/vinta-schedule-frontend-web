import type { Meta, StoryObj } from '../story-types';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './drawer';
import { Button } from './button';

/**
 * DrawerContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: drawer content only means something inside a Drawer.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerContent.
 */
const meta = {
  title: 'Components/DrawerContent',
  component: DrawerContent,
  tags: ['!dev'],
  // DrawerContent forwards vaul's Content props but curates no scalar of its
  // own worth exposing (the slide direction lives on the Drawer root).
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // Holds DrawerHeader/DrawerFooter plus arbitrary body content.
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DrawerContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer defaultOpen>
      <DrawerContent>
        <div className='mx-auto w-full max-w-sm'>
          <DrawerHeader>
            <DrawerTitle>Confirm time</DrawerTitle>
            <DrawerDescription>Mon, 9:00–9:30 AM</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button>Confirm</Button>
            <DrawerClose asChild>
              <Button variant='outline'>Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  ),
};
