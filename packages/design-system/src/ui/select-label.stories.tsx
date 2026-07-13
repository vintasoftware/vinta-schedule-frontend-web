import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectLabel — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a label only
 * means something inside SelectContent. It holds plain text, so `children`
 * is a text argType, not a slot.
 */
const meta = {
  title: 'Components/SelectLabel',
  component: SelectLabel,
  tags: ['!dev'],
  argTypes: {
    children: { control: 'text', description: 'Label text' },
  },
  args: { children: 'Connected calendars' },
} satisfies Meta<typeof SelectLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectLabel {...args} />
        <SelectItem value='google'>Google Calendar</SelectItem>
      </SelectContent>
    </Select>
  ),
};
