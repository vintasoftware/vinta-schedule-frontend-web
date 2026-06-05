import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'you@clinic.com' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  render: (args) => (
    <div className='grid w-72 gap-2'>
      <Label htmlFor='email'>Email</Label>
      <Input id='email' type='email' {...args} />
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true, value: 'Locked' } };

export const Types: Story = {
  render: () => (
    <div className='grid w-72 gap-3'>
      <Input type='text' placeholder='Text' />
      <Input type='password' placeholder='Password' />
      <Input type='number' placeholder='Number' />
      <Input type='date' />
      <Input type='file' />
    </div>
  ),
};
