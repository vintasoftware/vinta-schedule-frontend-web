import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EmailVerifyDialog } from './email-verify-dialog';
import { AuthStub } from './story-fixtures';

const meta = {
  title: 'Components/AccountSecurity/EmailVerifyDialog',
  component: EmailVerifyDialog,
  parameters: { layout: 'centered' },
  args: {
    email: 'ada@new.example.com',
    onOpenChange: () => {},
  },
} satisfies Meta<typeof EmailVerifyDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  render: (args) => (
    <AuthStub handlers={[]}>
      <EmailVerifyDialog {...args} />
    </AuthStub>
  ),
};
