import type { Meta, StoryObj } from '../story-types';

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from './navigation-menu';

/**
 * NavigationMenuList — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a menu list only
 * means something inside NavigationMenu (Radix's `List` renders inside the
 * root's `Primitive.ul` composition and expects the root's context). The
 * contract extractor still reads it (it only looks at title / argTypes /
 * parameters.puck), so the composer can bind and compose NavigationMenuList.
 */
const meta = {
  title: 'Components/NavigationMenuList',
  component: NavigationMenuList,
  tags: ['!dev'],
  // Container: a list holds NavigationMenuItems, so `children` is a slot and
  // must not also be an argType (§9). It has no other props of its own.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['NavigationMenuItem'] }] },
  },
} satisfies Meta<typeof NavigationMenuList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu>
      <NavigationMenuList {...args}>
        <NavigationMenuItem>
          <NavigationMenuLink>Pricing</NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
