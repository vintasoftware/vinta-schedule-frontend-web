import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { EmailsSection } from './emails-section';
import { AuthStub, ACCOUNT_EMAILS, type StubHandler } from './story-fixtures';

const SINGLE_EMAIL: StubHandler = [
  '/account/email',
  {
    status: 200,
    data: [{ email: 'ada@example.com', primary: true, verified: true }],
  },
];

const meta = {
  title: 'Components/AccountSecurity/EmailsSection',
  component: EmailsSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmailsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Primary + verified secondary + unverified address with per-state actions. */
export const SeveralAddresses: Story = {
  render: () => (
    <AuthStub handlers={[ACCOUNT_EMAILS]}>
      <EmailsSection />
    </AuthStub>
  ),
};

export const SingleAddress: Story = {
  render: () => (
    <AuthStub handlers={[SINGLE_EMAIL]}>
      <EmailsSection />
    </AuthStub>
  ),
};
