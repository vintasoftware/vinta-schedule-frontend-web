import type { Meta, StoryObj } from '../story-types';

import { Drawer, DrawerTrigger } from './drawer';

/**
 * DrawerTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a drawer trigger only means something inside a Drawer.
 * The contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose DrawerTrigger.
 */
const meta = {
  title: 'Components/DrawerTrigger',
  component: DrawerTrigger,
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
} satisfies Meta<typeof DrawerTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Drawer>
      <DrawerTrigger>Open drawer</DrawerTrigger>
    </Drawer>
  ),
};
