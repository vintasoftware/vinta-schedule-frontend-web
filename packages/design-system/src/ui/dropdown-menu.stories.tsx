import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

const meta = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
  tags: ['autodocs'],
  // Radix DropdownMenu.Root scalars. `children` (trigger + content) is composed
  // content → a slot, never an argTypes key.
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open on first render (uncontrolled)',
    },
    modal: {
      control: 'boolean',
      description: 'Block interaction with the page while the menu is open',
    },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  args: { defaultOpen: false, modal: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuLabel>Appointment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Reschedule
          <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Copy link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className='text-destructive'>Cancel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
