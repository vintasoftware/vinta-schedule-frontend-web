import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SocialAccountsSection } from './social-accounts-section';
import {
  AuthStub,
  CONFIG_FULL,
  LINKED_GOOGLE,
  SESSION_WITH_PASSWORD,
  SESSION_SOCIAL_NO_PASSWORD,
  type StubHandler,
} from './story-fixtures';

const NO_LINKED_ACCOUNTS: StubHandler = [
  '/account/providers',
  { status: 200, data: [] },
];

const meta = {
  title: 'Components/AccountSecurity/SocialAccountsSection',
  component: SocialAccountsSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SocialAccountsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Google linked; Apple and Facebook offer Connect. */
export const GoogleLinked: Story = {
  render: () => (
    <AuthStub handlers={[LINKED_GOOGLE, CONFIG_FULL, SESSION_WITH_PASSWORD]}>
      <SocialAccountsSection />
    </AuthStub>
  ),
};

/** Nothing linked yet — all providers connectable. */
export const NothingLinked: Story = {
  render: () => (
    <AuthStub
      handlers={[NO_LINKED_ACCOUNTS, CONFIG_FULL, SESSION_SOCIAL_NO_PASSWORD]}
    >
      <SocialAccountsSection />
    </AuthStub>
  ),
};
