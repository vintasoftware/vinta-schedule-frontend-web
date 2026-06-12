import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhoneVerifyDialog } from './phone-verify-dialog';
import { AuthStub } from './story-fixtures';

const meta = {
  title: 'Components/AccountSecurity/PhoneVerifyDialog',
  component: PhoneVerifyDialog,
  parameters: { layout: 'centered' },
  args: {
    phone: '+1 555 555 5555',
    onOpenChange: () => {},
  },
} satisfies Meta<typeof PhoneVerifyDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 8-digit SMS OTP entry with resend; input disables after 3 failed attempts. */
export const Open: Story = {
  render: (args) => (
    <AuthStub handlers={[]}>
      <PhoneVerifyDialog {...args} />
    </AuthStub>
  ),
};
