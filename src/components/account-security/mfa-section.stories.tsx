import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { MfaSection } from './mfa-section';
import {
  AuthStub,
  CONFIG_FULL,
  TOTP_ACTIVE,
  TOTP_NOT_SET_UP,
  RECOVERY_CODES,
  AUTHENTICATORS,
} from './story-fixtures';

const meta = {
  title: 'Components/AccountSecurity/MfaSection',
  component: MfaSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MfaSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** TOTP active — disable + recovery codes available. */
export const Enabled: Story = {
  render: () => (
    <AuthStub
      handlers={[TOTP_ACTIVE, RECOVERY_CODES, AUTHENTICATORS, CONFIG_FULL]}
    >
      <MfaSection />
    </AuthStub>
  ),
};

/** TOTP not configured — the 404 carries the setup secret, Enable opens the QR dialog. */
export const Disabled: Story = {
  render: () => (
    <AuthStub
      handlers={[TOTP_NOT_SET_UP, RECOVERY_CODES, AUTHENTICATORS, CONFIG_FULL]}
    >
      <MfaSection />
    </AuthStub>
  ),
};
