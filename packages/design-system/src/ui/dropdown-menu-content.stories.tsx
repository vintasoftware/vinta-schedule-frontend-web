import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the content panel
 * only means something inside DropdownMenu (it reads the root's Radix
 * context and throws outside it). The contract extractor still reads it, so
 * the composer can bind and compose DropdownMenuContent.
 */
const meta = {
  title: 'Components/DropdownMenuContent',
  component: DropdownMenuContent,
  tags: ['!dev'],
  argTypes: {
    align: { control: 'inline-radio', options: ['start', 'center', 'end'] },
    sideOffset: {
      control: 'number',
      description: 'Distance from the trigger, in pixels',
    },
  },
  args: { align: 'start', sideOffset: 4 },
  // A content panel holds menu content: items, checkboxes, radio groups,
  // labels, separators, groups, and submenus — nothing else.
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: [
            'DropdownMenuItem',
            'DropdownMenuCheckboxItem',
            'DropdownMenuRadioGroup',
            'DropdownMenuLabel',
            'DropdownMenuSeparator',
            'DropdownMenuGroup',
            'DropdownMenuSub',
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof DropdownMenuContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...args} className='w-52'>
        <DropdownMenuLabel>Appointment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Reschedule</DropdownMenuItem>
        <DropdownMenuItem>Copy link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
