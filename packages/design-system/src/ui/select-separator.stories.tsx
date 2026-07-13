import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectSeparator — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a separator only
 * means something inside SelectContent. It has no interesting props, so it
 * falls back to `id` per the contract convention.
 */
const meta = {
  title: 'Components/SelectSeparator',
  component: SelectSeparator,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof SelectSeparator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='google'>Google Calendar</SelectItem>
        <SelectSeparator {...args} />
        <SelectItem value='outlook'>Outlook</SelectItem>
      </SelectContent>
    </Select>
  ),
};
