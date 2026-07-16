import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from './switch';
import { Label } from './label';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  argTypes: {
    defaultChecked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    name: { control: 'text', description: 'Name submitted with the form' },
    value: { control: 'text', description: 'Value submitted when checked' },
  },
  args: { defaultChecked: true },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className='flex items-center gap-2'>
      <Switch id='avail' {...args} />
      <Label htmlFor='avail'>Accepting bookings</Label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className='flex items-center gap-2'>
      <Switch id='dis' disabled />
      <Label htmlFor='dis'>Disabled</Label>
    </div>
  ),
};
