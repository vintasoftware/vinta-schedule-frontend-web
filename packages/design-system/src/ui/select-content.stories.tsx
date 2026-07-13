import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectContent — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: the options panel
 * only means something inside Select (it reads the root's Radix context and
 * throws outside it). `children` is restricted to the option-list building
 * blocks.
 */
const meta = {
  title: 'Components/SelectContent',
  component: SelectContent,
  tags: ['!dev'],
  argTypes: {
    position: { control: 'inline-radio', options: ['item-aligned', 'popper'] },
  },
  args: { position: 'popper' },
  parameters: {
    puck: {
      slots: [
        {
          name: 'children',
          allow: [
            'SelectItem',
            'SelectGroup',
            'SelectLabel',
            'SelectSeparator',
          ],
        },
      ],
    },
  },
} satisfies Meta<typeof SelectContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent {...args}>
        <SelectItem value='google'>Google Calendar</SelectItem>
        <SelectItem value='outlook'>Outlook</SelectItem>
      </SelectContent>
    </Select>
  ),
};
