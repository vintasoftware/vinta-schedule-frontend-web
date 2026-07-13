import type { Meta, StoryObj } from '../story-types';

import { InputOTP, InputOTPGroup, InputOTPSlot } from './input-otp';

/**
 * InputOTPSlot — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a slot reads its
 * character/caret state from the InputOTP root's context via
 * `useContext(OTPInputContext)` and THROWS outside it. The contract extractor
 * still reads it (it only looks at title / argTypes / parameters.puck), so
 * the composer can bind and compose InputOTPSlot.
 */
const meta = {
  title: 'Components/InputOTPSlot',
  component: InputOTPSlot,
  tags: ['!dev'],
  // Leaf: renders the character read from context, no composed children.
  argTypes: {
    index: { control: 'number', description: 'Position within the OTP code' },
  },
  args: { index: 0 },
} satisfies Meta<typeof InputOTPSlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <InputOTP maxLength={3}>
      <InputOTPGroup>
        <InputOTPSlot {...args} />
      </InputOTPGroup>
    </InputOTP>
  ),
};
