import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuSub — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a submenu only
 * means something inside DropdownMenuContent. `children` holds exactly the
 * sub-trigger and the sub-content, so the slot is restricted.
 */
const meta = {
  title: 'Components/DropdownMenuSub',
  component: DropdownMenuSub,
  tags: ['!dev'],
  argTypes: {
    defaultOpen: {
      control: 'boolean',
      description: 'Open the submenu on first render (uncontrolled)',
    },
  },
  args: { defaultOpen: true },
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: ['DropdownMenuSubTrigger', 'DropdownMenuSubContent'],
        },
      ],
    },
  },
} satisfies Meta<typeof DropdownMenuSub>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuItem>Reschedule</DropdownMenuItem>
        <DropdownMenuSub {...args}>
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Email invite</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
