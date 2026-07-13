import type { Meta, StoryObj } from '../story-types';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Button } from './button';

/**
 * DropdownMenuCheckboxItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a checkbox item
 * only means something inside DropdownMenuContent. `children` holds the label
 * (icon + text), so it stays an unrestricted slot.
 */
const meta = {
  title: 'Components/DropdownMenuCheckboxItem',
  component: DropdownMenuCheckboxItem,
  tags: ['!dev'],
  argTypes: {
    checked: { control: 'boolean', description: 'Whether the item is checked' },
  },
  args: { checked: true },
  parameters: { puck: { slots: ['children'] } },
} satisfies Meta<typeof DropdownMenuCheckboxItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant='outline'>View</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start' className='w-52'>
        <DropdownMenuCheckboxItem {...args}>
          Show archived
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
