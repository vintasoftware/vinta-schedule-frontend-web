import type { Meta, StoryObj } from '../story-types';

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './navigation-menu';

/**
 * NavigationMenuTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a trigger reads
 * open/closed state from the NavigationMenuItem it lives in and THROWS
 * outside a NavigationMenu tree. The contract extractor still reads it (it
 * only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose NavigationMenuTrigger.
 */
const meta = {
  title: 'Components/NavigationMenuTrigger',
  component: NavigationMenuTrigger,
  tags: ['!dev'],
  // The trigger label is arbitrary content, so the slot is left UNRESTRICTED.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof NavigationMenuTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger {...args}>Product</NavigationMenuTrigger>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
