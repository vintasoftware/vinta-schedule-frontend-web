import type { Meta, StoryObj } from '../story-types';

import { InputOTP, InputOTPGroup, InputOTPSlot } from './input-otp';

/**
 * InputOTPGroup — BINDING-ONLY story.
 *
 * `tags: ['!dev']` keeps this out of the Storybook sidebar: a group only
 * means something inside InputOTP. The contract extractor still reads it (it
 * only looks at title / argTypes / parameters.puck), so the composer can
 * bind and compose InputOTPGroup.
 */
const meta = {
  title: 'Components/InputOTPGroup',
  component: InputOTPGroup,
  tags: ['!dev'],
  // Container: a group holds InputOTPSlots, so `children` is a slot and must
  // not also be an argType (§9). It is a plain <div> with no other props.
  argTypes: {
    id: { control: 'text', description: 'DOM id — anchors, tests' },
  },
  args: {},
  parameters: {
    puck: { slots: [{ name: 'children', allow: ['InputOTPSlot'] }] },
  },
} satisfies Meta<typeof InputOTPGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <InputOTP maxLength={3}>
      <InputOTPGroup {...args}>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
    </InputOTP>
  ),
};
