import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuSeparator — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a separator only
 * means something inside DropdownMenuContent. It has no interesting props, so
 * it falls back to `id` per the contract convention.
 */
const meta = {
  title: 'Components/DropdownMenuSeparator',
  component: DropdownMenuSeparator,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof DropdownMenuSeparator>;

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
        <DropdownMenuSeparator {...args} />
        <DropdownMenuItem>Cancel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
