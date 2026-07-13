import type { Meta, StoryObj } from '../story-types';

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './drawer';

/**
 * DrawerTitle — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer title only means something inside DrawerHeader.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerTitle.
 */
const meta = {
  title: 'Components/DrawerTitle',
  component: DrawerTitle,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Copy' },
  },
  args: { children: 'Confirm time' },
} satisfies Meta<typeof DrawerTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer defaultOpen>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Confirm time</DrawerTitle>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  ),
};
