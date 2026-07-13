import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an option only
 * means something inside SelectContent (it reads the root's Radix context).
 * It holds plain text, so `children` is a text argType, not a slot.
 */
const meta = {
  title: 'Components/SelectItem',
  component: SelectItem,
  tags: ['!dev'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Value submitted when this option is selected',
    },
    children: { control: 'text', description: 'Option label text' },
  },
  args: { value: 'google', children: 'Google Calendar' },
} satisfies Meta<typeof SelectItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem {...args} />
      </SelectContent>
    </Select>
  ),
};
