import type { Meta, StoryObj } from '@storybook/react-vite';

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
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select>
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
