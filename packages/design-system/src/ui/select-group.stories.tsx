import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectGroup — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a group only
 * means something inside SelectContent. It has no interesting props, so it
 * falls back to `id` per the contract convention. `children` holds a bounded
 * set of related options.
 */
const meta = {
  title: 'Components/SelectGroup',
  component: SelectGroup,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: {
      slots: [{ name: 'children', allow: ['SelectItem', 'SelectLabel'] }],
    },
  },
} satisfies Meta<typeof SelectGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup {...args}>
          <SelectLabel>Connected calendars</SelectLabel>
          <SelectItem value='google'>Google Calendar</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
