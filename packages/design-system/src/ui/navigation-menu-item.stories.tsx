import type { Meta, StoryObj } from '../story-types';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './navigation-menu';

/**
 * NavigationMenuItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an item only
 * means something inside a NavigationMenuList, which itself only means
 * something inside NavigationMenu. The contract extractor still reads it (it
 * only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose NavigationMenuItem.
 */
const meta = {
  title: 'Components/NavigationMenuItem',
  component: NavigationMenuItem,
  tags: ['!dev'],
  // Container: an item composes either a trigger+content pair or a bare link,
  // so `children` is a slot and must not also be an argType (§9).
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: [
            'NavigationMenuTrigger',
            'NavigationMenuContent',
            'NavigationMenuLink',
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof NavigationMenuItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem {...args}>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink>Calendar sync</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
