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
 * NavigationMenuContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the flyout panel
 * reads open/closed + motion state from the NavigationMenuItem it lives in
 * and THROWS outside a NavigationMenu tree. The contract extractor still
 * reads it (it only looks at title / argTypes / parameters.puck), so the
 * composer can bind and compose NavigationMenuContent.
 */
const meta = {
  title: 'Components/NavigationMenuContent',
  component: NavigationMenuContent,
  tags: ['!dev'],
  // Flyout content is arbitrary — links, lists, cards — so the slot is left
  // UNRESTRICTED.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof NavigationMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent {...args}>
            <NavigationMenuLink>Calendar sync</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
