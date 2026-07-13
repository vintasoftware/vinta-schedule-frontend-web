import type { Meta, StoryObj } from '../story-types';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from './input-otp';

const meta = {
  title: 'Components/InputOTP',
  component: InputOTP,
  tags: ['autodocs'],
  // Container: InputOTP renders composed children (the groups/slots/separator),
  // so `children` is a slot and must not also be an argType (§5). argTypes are
  // real `OTPInput` props (§6: containerClassName/className stay unexposed).
  argTypes: {
    maxLength: {
      control: 'number',
      description: 'Number of characters in the code',
    },
    textAlign: {
      control: 'inline-radio',
      options: ['left', 'center', 'right'],
    },
    disabled: { control: 'boolean' },
    autoFocus: { control: 'boolean' },
  },
  args: { maxLength: 6 },
  // An OTP field composes groups of slots plus an optional separator between
  // groups — nothing else belongs directly under the root.
  parameters: {
    puck: {
      slots: [
        { name: 'children', allow: ['InputOTPGroup', 'InputOTPSeparator'] },
      ],
    },
  },
} satisfies Meta<typeof InputOTP>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <InputOTP maxLength={6} {...args}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
};
