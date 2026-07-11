import type { Meta, StoryObj } from '../story-types';

import { Textarea } from './textarea';
import { Label } from './label';

const meta = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  // Leaf form control — self-closing, so NO slot. Real
  // `React.ComponentProps<'textarea'>` members only (§6: no className/style).
  argTypes: {
    placeholder: { control: 'text' },
    rows: { control: 'number', description: 'Visible number of text lines' },
    defaultValue: {
      control: 'text',
      description: 'Initial (uncontrolled) value',
    },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    readOnly: { control: 'boolean' },
  },
  args: { placeholder: 'Notes for the visit…', rows: 3 },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => <Textarea className='w-80' {...args} />,
};

export const WithLabel: Story = {
  render: (args) => (
    <div className='grid w-80 gap-2'>
      <Label htmlFor='notes'>Appointment notes</Label>
      <Textarea id='notes' {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => <Textarea className='w-80' {...args} />,
};
