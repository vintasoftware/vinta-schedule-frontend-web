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

const meta = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
  // Container: `Select` (Radix Select.Root) renders composed children — the
  // trigger and the content list — so `children` is a slot and must not also be
  // an argType (§5). argTypes below are real Select.Root props (§6).
  argTypes: {
    defaultValue: {
      control: 'text',
      description: 'Value of the item selected by default',
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Open the menu on mount (uncontrolled)',
    },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    name: { control: 'text', description: 'Name submitted with the form' },
    dir: { control: 'inline-radio', options: ['ltr', 'rtl'] },
  },
  parameters: {
    puck: {
      slots: [{ name: 'children', allow: ['SelectTrigger', 'SelectContent'] }],
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Select {...args}>
      <SelectTrigger className='w-64'>
        <SelectValue placeholder='Pick a calendar' />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Connected calendars</SelectLabel>
          <SelectItem value='google'>Google Calendar</SelectItem>
          <SelectItem value='outlook'>Outlook</SelectItem>
          <SelectItem value='ical'>Apple iCloud</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  ),
};
