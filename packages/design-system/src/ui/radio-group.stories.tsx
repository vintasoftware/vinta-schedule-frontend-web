import type { Meta, StoryObj } from '@storybook/react-vite';

import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    defaultValue: {
      control: 'text',
      description: 'Value of the item checked by default',
    },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    loop: {
      control: 'boolean',
      description: 'Wrap keyboard focus from last item back to first',
    },
    name: { control: 'text', description: 'Name submitted with the form' },
  },
  args: { defaultValue: '30' },
  // Left UNRESTRICTED on purpose: a radio group legally contains layout
  // wrappers and labels around each RadioGroupItem (e.g. Flex > RadioGroupItem
  // + Label), so the set of legal children is open. Restricting this to
  // RadioGroupItem would forbid labelled rows, which is the normal usage.
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <RadioGroup {...args} className='gap-3'>
      {[
        { v: '15', l: '15 minutes' },
        { v: '30', l: '30 minutes' },
        { v: '60', l: '1 hour' },
      ].map(({ v, l }) => (
        <div key={v} className='flex items-center gap-2'>
          <RadioGroupItem value={v} id={`dur-${v}`} />
          <Label htmlFor={`dur-${v}`}>{l}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};
