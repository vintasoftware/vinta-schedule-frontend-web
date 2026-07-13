import type { Meta, StoryObj } from '../story-types';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from './drawer';

/**
 * DrawerHeader — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer header only means something inside DrawerContent.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerHeader.
 */
const meta = {
  title: 'Components/DrawerHeader',
  component: DrawerHeader,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  // A header only makes sense with a title and optional description.
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['DrawerTitle', 'DrawerDescription'] },
      ],
    },
  },
} satisfies Meta<typeof DrawerHeader>;

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
