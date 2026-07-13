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
 * DropdownMenuSubContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a sub-content
 * panel only means something inside DropdownMenuSub (it reads the sub's
 * Radix context). It has no interesting props, so it falls back to `id` per
 * the contract convention.
 */
const meta = {
  title: 'Components/DropdownMenuSubContent',
  component: DropdownMenuSubContent,
  tags: ['!dev'],
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
            'DropdownMenuItem',
            'DropdownMenuCheckboxItem',
            'DropdownMenuLabel',
            'DropdownMenuSeparator',
            'DropdownMenuGroup',
            'DropdownMenuSub',
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof DropdownMenuSubContent>;

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
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent {...args}>
            <DropdownMenuItem>Email invite</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
