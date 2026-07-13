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
 * DropdownMenuShortcut — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a shortcut hint
 * only means something inside DropdownMenuItem. It holds plain text, so
 * `children` is a text argType, not a slot.
 */
const meta = {
  title: 'Components/DropdownMenuShortcut',
  component: DropdownMenuShortcut,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Shortcut hint text' },
  },
  args: { children: '⌘R' },
} satisfies Meta<typeof DropdownMenuShortcut>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuItem>
          Reschedule
          <DropdownMenuShortcut {...args} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
