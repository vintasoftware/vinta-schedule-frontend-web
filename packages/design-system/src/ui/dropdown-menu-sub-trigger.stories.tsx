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
 * DropdownMenuSubTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sub-trigger
 * only means something inside DropdownMenuSub. `children` holds an icon +
 * text, so it stays an unrestricted slot.
 */
const meta = {
  title: 'Components/DropdownMenuSubTrigger',
  component: DropdownMenuSubTrigger,
  tags: ['!dev'],
  argTypes: {
    inset: {
      control: 'boolean',
      description: 'Indent to align with items that have an icon',
    },
  },
  args: { inset: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenuSubTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuSub defaultOpen>
          <DropdownMenuSubTrigger {...args}>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>Email invite</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
