import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './navigation-menu';

const meta = {
  title: 'Components/NavigationMenu',
  component: NavigationMenu,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
    defaultValue: {
      control: 'text',
      description: 'Value of the item open on first render',
    },
    delayDuration: {
      control: 'number',
      description: 'Ms from pointer-enter until the menu opens',
    },
    skipDelayDuration: {
      control: 'number',
      description: 'Ms the user has to move between items without a delay',
    },
  },
  args: { orientation: 'horizontal', delayDuration: 200 },
  // The root only ever composes a single NavigationMenuList; the viewport is
  // internal plumbing the root renders itself and is never user-composed.
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <NavigationMenu {...args}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className='grid w-64 gap-1 p-3'>
              <li>
                <NavigationMenuLink className='hover:bg-accent block rounded-md p-2 text-sm'>
                  Calendar sync
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink className='hover:bg-accent block rounded-md p-2 text-sm'>
                  Booking pages
                </NavigationMenuLink>
              </li>
              <li>
                <NavigationMenuLink className='hover:bg-accent block rounded-md p-2 text-sm'>
                  Availability
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink className='px-3 py-2 text-sm font-medium'>
            Pricing
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  ),
};
