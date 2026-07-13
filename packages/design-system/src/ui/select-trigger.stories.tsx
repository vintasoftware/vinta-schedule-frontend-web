import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectTrigger — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a trigger only
 * means something inside Select. It has no interesting props, so it falls
 * back to `id` per the contract convention. `children` is restricted to
 * SelectValue — the only thing a Radix select trigger is meant to display.
 */
const meta = {
  title: 'Components/SelectTrigger',
  component: SelectTrigger,
  tags: ['!dev'],
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['SelectValue'] }] },
  },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger {...args} className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='google'>Google Calendar</SelectItem>
      </SelectContent>
    </Select>
  ),
};
