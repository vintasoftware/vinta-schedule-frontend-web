import type { Meta, StoryObj } from '../story-types';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from './drawer';

/**
 * DrawerDescription — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer description only means something inside DrawerHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerDescription.
 */
const meta = {
  title: 'Components/DrawerDescription',
  component: DrawerDescription,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Mon, 9:00–9:30 AM' },
} satisfies Meta<typeof DrawerDescription>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer defaultOpen>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Confirm time</DrawerTitle>
          <DrawerDescription>Mon, 9:00–9:30 AM</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
};
