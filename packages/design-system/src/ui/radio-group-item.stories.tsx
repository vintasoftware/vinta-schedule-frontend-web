import type { Meta, StoryObj } from '../story-types';

import { RadioGroup, RadioGroupItem } from './radio-group';

/**
 * RadioGroupItem — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: an item reads
 * checked/selected state from the RadioGroup root's context and THROWS
 * outside it. The contract extractor still reads it (it only looks at title
 * / argTypes / parameters.puck), so the composer can bind and compose
 * RadioGroupItem.
 */
const meta = {
  title: 'Components/RadioGroupItem',
  component: RadioGroupItem,
  tags: ['!dev'],
  // Leaf: renders a fixed radio dot, no composed children (§9).
  argTypes: {
    value: { control: 'text', description: 'Value submitted when selected' },
    disabled: { control: 'boolean' },
  },
  args: { value: '30' },
} satisfies Meta<typeof RadioGroupItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <RadioGroup defaultValue='30'>
      <RadioGroupItem {...args} />
    </RadioGroup>
  ),
};
