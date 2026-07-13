import type { Meta, StoryObj } from '../story-types';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from './navigation-menu';

/**
 * NavigationMenuLink — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a link only
 * means something inside a NavigationMenuItem, which itself only means
 * something inside NavigationMenu. The contract extractor still reads it (it
 * only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose NavigationMenuLink.
 */
const meta = {
  title: 'Components/NavigationMenuLink',
  component: NavigationMenuLink,
  tags: ['!dev'],
  // Leaf: holds text plus a real navigation target, no composed children.
  argTypes: {
    children: { control: 'text', description: 'Link label' },
    href: { control: 'text', description: 'Navigation target' },
  },
  args: { children: 'Pricing', href: '#' },
} satisfies Meta<typeof NavigationMenuLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink {...args} />
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
