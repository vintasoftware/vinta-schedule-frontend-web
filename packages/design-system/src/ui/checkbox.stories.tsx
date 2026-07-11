import type { Meta, StoryObj } from '../story-types';

import { Checkbox } from './checkbox';
import { Label } from './label';

const meta = {
  title: 'Components/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  // Leaf control: the Radix `Checkbox.Root` renders its own Indicator, so it
  // takes no composed content — NO slot. These are real Radix Root props
  // (§6: className/style stay unexposed).
  argTypes: {
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    name: { control: 'text', description: 'Name submitted with the form' },
    value: { control: 'text', description: 'Value submitted when checked' },
  },
  args: { defaultChecked: true },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className='flex items-center gap-2'>
      <Checkbox id='sync' {...args} />
      <Label htmlFor='sync'>Sync to Google Calendar</Label>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        <Checkbox id='a' />
        <Label htmlFor='a'>Unchecked</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox id='b' defaultChecked />
        <Label htmlFor='b'>Checked</Label>
      </div>
      <div className='flex items-center gap-2'>
        <Checkbox id='c' disabled />
        <Label htmlFor='c'>Disabled</Label>
      </div>
    </div>
  ),
};
