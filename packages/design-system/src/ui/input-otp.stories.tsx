import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentProps } from 'react';

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from './input-otp';

/**
 * InputOTP takes a `render` prop, which collides with Storybook's own `render`
 * story field — so the args are typed without it. Its props are also a union
 * (`children` XOR `render`); dropping `render` leaves the children branch, which
 * is the one these stories use.
 */
type InputOTPArgs = Omit<ComponentProps<typeof InputOTP>, 'render'>;

const meta = {
  title: 'Components/InputOTP',
  component: InputOTP,
  tags: ['autodocs'],
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
} satisfies Meta<typeof InputOTP>;

export default meta;
type Story = StoryObj<InputOTPArgs>;

export const Default: Story = {
  // Props are passed explicitly rather than spread: InputOTP's props are a union
  // (`children` XOR a `render` callback), so spreading `args` leaves TypeScript
  // unable to tell which branch we are on once children are also present.
  render: ({ maxLength, textAlign, disabled, autoFocus }) => (
    <InputOTP
      maxLength={maxLength}
      textAlign={textAlign}
      disabled={disabled}
      autoFocus={autoFocus}
    >
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
