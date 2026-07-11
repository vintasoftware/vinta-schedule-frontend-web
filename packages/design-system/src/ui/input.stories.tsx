import type { Meta, StoryObj } from '../story-types';

import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  // Leaf form control — self-closing, so NO slot. Props below are the real
  // `React.ComponentProps<'input'>` members worth exposing to a designer.
  // `className`/`style` are deliberately not exposed (§6).
  argTypes: {
    type: {
      control: 'select',
      options: [
        'text',
        'email',
        'password',
        'number',
        'tel',
        'url',
        'search',
        'date',
        'time',
      ],
    },
    placeholder: { control: 'text' },
    defaultValue: {
      control: 'text',
      description: 'Initial (uncontrolled) value',
    },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  args: { type: 'email', placeholder: 'you@clinic.com' },
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

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Locked' },
};

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
