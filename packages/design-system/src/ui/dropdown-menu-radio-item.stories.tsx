import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuRadioItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a radio item only
 * means something inside DropdownMenuRadioGroup (it reads the group's Radix
 * context). `children` holds the label, so it stays an unrestricted slot.
 */
const meta = {
  title: 'Components/DropdownMenuRadioItem',
  component: DropdownMenuRadioItem,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Value submitted when this item is selected',
    },
  },
  args: { value: 'a' },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenuRadioItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Sort by</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuRadioGroup value='a'>
          <DropdownMenuRadioItem {...args}>Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='b'>Date</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
