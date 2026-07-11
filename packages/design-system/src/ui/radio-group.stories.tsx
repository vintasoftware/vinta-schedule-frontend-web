import type { Meta, StoryObj } from '../story-types';

import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

const meta = {
  title: 'Components/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  // Container: RadioGroup renders composed `children` (its RadioGroupItems), so
  // `children` is a slot — and therefore must NOT also appear in argTypes (§5).
  // The argTypes below are real `RadioGroup.Root` props (§6: no className).
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
  parameters: { puck: { slots: ['children'] } },
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
