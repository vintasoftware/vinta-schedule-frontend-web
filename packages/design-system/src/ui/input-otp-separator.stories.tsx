import type { Meta, StoryObj } from '../story-types';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from './input-otp';

/**
 * InputOTPSeparator — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a separator only
 * means something between groups inside InputOTP. The contract extractor
 * still reads it (it only looks at title / argTypes / parameters.puck), so
 * the composer can bind and compose InputOTPSeparator.
 */
const meta = {
  title: 'Components/InputOTPSeparator',
  component: InputOTPSeparator,
  tags: ['!dev'],
  // Leaf: renders a fixed dash icon, no interesting props of its own.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
} satisfies Meta<typeof InputOTPSeparator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <InputOTP maxLength={6}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator {...args} />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};
