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
 * DropdownMenuRadioGroup — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a radio group
 * only means something inside DropdownMenuContent. `children` holds exactly
 * DropdownMenuRadioItem, so the slot is restricted.
 */
const meta = {
  title: 'Components/DropdownMenuRadioGroup',
  component: DropdownMenuRadioGroup,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Value of the currently selected item',
    },
  },
  args: { value: 'a' },
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['DropdownMenuRadioItem'] }] },
  },
} satisfies Meta<typeof DropdownMenuRadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>Sort by</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuRadioGroup {...args}>
          <DropdownMenuRadioItem value='a'>Name</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value='b'>Date</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
