import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PasswordSection } from './password-section';
import {
  AuthStub,
  SESSION_WITH_PASSWORD,
  SESSION_SOCIAL_NO_PASSWORD,
} from './story-fixtures';

const meta = {
  title: 'Components/AccountSecurity/PasswordSection',
  component: PasswordSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PasswordSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** User signed up with email/password → "Change password" with current field. */
export const ChangePassword: Story = {
  render: () => (
    <AuthStub handlers={[SESSION_WITH_PASSWORD]}>
      <PasswordSection />
    </AuthStub>
  ),
};

/** Social-signup user with no password yet → "Set password", no current field. */
export const SetPassword: Story = {
  render: () => (
    <AuthStub handlers={[SESSION_SOCIAL_NO_PASSWORD]}>
      <PasswordSection />
    </AuthStub>
  ),
};
