import type { Meta, StoryObj } from '@storybook/nextjs-vite';

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
} satisfies Meta<typeof NavigationMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <NavigationMenu>
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
