import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuGroup — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a group only
 * means something inside DropdownMenuContent. It has no interesting props, so
 * it falls back to `id` per the contract convention. `children` holds a
 * bounded set of related menu entries.
 */
const meta = {
  title: 'Components/DropdownMenuGroup',
  component: DropdownMenuGroup,
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
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof DropdownMenuGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuGroup {...args}>
          <DropdownMenuLabel>Appointment</DropdownMenuLabel>
          <DropdownMenuItem>Reschedule</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
