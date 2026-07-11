import type { Meta, StoryObj } from '../story-types';

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
  // Radix NavigationMenu.Root scalars (`value` / `onValueChange` are
  // controlled-mode only). `children` (the NavigationMenuList) is composed
  // content → a slot; the root also renders its own viewport after it.
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
  parameters: { puck: { slots: ['children'] } },
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
