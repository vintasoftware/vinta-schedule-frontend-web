import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuLabel — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a label only means
 * something inside DropdownMenuContent. It holds plain text, so `children` is
 * a text argType, not a slot.
 */
const meta = {
  title: 'Components/DropdownMenuLabel',
  component: DropdownMenuLabel,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Label text' },
    inset: {
      control: 'boolean',
      description: 'Indent to align with items that have an icon',
    },
  },
  args: { children: 'Appointment', inset: false },
} satisfies Meta<typeof DropdownMenuLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuLabel {...args} />
        <DropdownMenuItem>Reschedule</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
