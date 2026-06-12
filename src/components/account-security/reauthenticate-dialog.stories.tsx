import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { ReauthenticateDialog } from './reauthenticate-dialog';
import { AuthStub } from './story-fixtures';

const noop = async () => {};

const meta = {
  title: 'Components/AccountSecurity/ReauthenticateDialog',
  component: ReauthenticateDialog,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ReauthenticateDialog>;

export default meta;
// Plain StoryObj: `request` is supplied inside each render, not via args.
type Story = StoryObj;

/** Backend offered password reauthentication only. */
export const PasswordOnly: Story = {
  render: () => (
    <AuthStub handlers={[]}>
      <ReauthenticateDialog
        request={{ flows: ['reauthenticate'], retry: noop, cancel: () => {} }}
      />
    </AuthStub>
  ),
};

/** Both methods available — toggle between password and authenticator code. */
export const PasswordOrMfa: Story = {
  render: () => (
    <AuthStub handlers={[]}>
      <ReauthenticateDialog
        request={{
          flows: ['reauthenticate', 'mfa_reauthenticate'],
          retry: noop,
          cancel: () => {},
        }}
      />
    </AuthStub>
  ),
};

/** MFA-only (e.g. social-signup user without a password). */
export const MfaOnly: Story = {
  render: () => (
    <AuthStub handlers={[]}>
      <ReauthenticateDialog
        request={{
          flows: ['mfa_reauthenticate'],
          retry: noop,
          cancel: () => {},
        }}
      />
    </AuthStub>
  ),
};
