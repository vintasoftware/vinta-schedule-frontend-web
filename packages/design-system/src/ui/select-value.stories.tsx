import type { Meta, StoryObj } from '../story-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

/**
 * SelectValue — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a value display
 * only means something inside SelectTrigger. It renders the selected item's
 * text (or its placeholder), so `placeholder` is a text argType, not a slot.
 */
const meta = {
  title: 'Components/SelectValue',
  component: SelectValue,
  tags: ['!dev'],
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Text shown when nothing is selected',
    },
  },
  args: { placeholder: 'Pick a calendar' },
} satisfies Meta<typeof SelectValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select defaultOpen>
      <SelectTrigger className='w-64'>
        <SelectValue {...args} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='google'>Google Calendar</SelectItem>
      </SelectContent>
    </Select>
  ),
};
