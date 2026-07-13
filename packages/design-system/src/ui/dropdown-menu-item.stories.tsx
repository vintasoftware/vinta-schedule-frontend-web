import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an item only means
 * something inside DropdownMenuContent. `children` holds an icon + text + an
 * optional shortcut, so it stays an unrestricted slot.
 */
const meta = {
  title: 'Components/DropdownMenuItem',
  component: DropdownMenuItem,
  tags: ['!dev'],
  argTypes: {
    inset: {
      control: 'boolean',
      description: 'Indent to align with items that have an icon',
    },
  },
  args: { inset: false },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenuItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuItem {...args}>
          Reschedule
          <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
