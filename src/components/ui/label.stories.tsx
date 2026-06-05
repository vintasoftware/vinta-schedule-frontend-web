import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { Label } from './label';
import { Input } from './input';

const meta = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs'],
  args: { children: 'Patient name' },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInput: Story = {
  render: () => (
    <div className='grid w-72 gap-2'>
      <Label htmlFor='name'>Patient name</Label>
      <Input id='name' placeholder='Jane Doe' />
    </div>
  ),
};
