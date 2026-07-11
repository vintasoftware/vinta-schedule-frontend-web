import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from './switch';
import { Label } from './label';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className='flex items-center gap-2'>
      <Switch id='avail' defaultChecked />
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
