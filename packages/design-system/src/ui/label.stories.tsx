import type { Meta, StoryObj } from '@storybook/react-vite';

import { Label } from './label';
import { Input } from './input';

const meta = {
  title: 'Components/Label',
  component: Label,
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text', description: 'Label text' },
    htmlFor: {
      control: 'text',
      description: 'id of the form control this label describes',
    },
  },
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
