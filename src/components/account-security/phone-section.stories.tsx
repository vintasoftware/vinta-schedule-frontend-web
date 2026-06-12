import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { PhoneSection } from './phone-section';
import {
  AuthStub,
  ACCOUNT_PHONE_VERIFIED,
  ACCOUNT_PHONE_NONE,
  type StubHandler,
} from './story-fixtures';

const PHONE_UNVERIFIED: StubHandler = [
  '/account/phone',
  { status: 200, data: [{ phone: '+1 555 555 5555', verified: false }] },
];

const meta = {
  title: 'Components/AccountSecurity/PhoneSection',
  component: PhoneSection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PhoneSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {
  render: () => (
    <AuthStub handlers={[ACCOUNT_PHONE_VERIFIED]}>
      <PhoneSection />
    </AuthStub>
  ),
};

/** Unverified number — offers Verify alongside Change. */
export const Unverified: Story = {
  render: () => (
    <AuthStub handlers={[PHONE_UNVERIFIED]}>
      <PhoneSection />
    </AuthStub>
  ),
};

/** No phone yet — shows the add form directly. */
export const NoPhone: Story = {
  render: () => (
    <AuthStub handlers={[ACCOUNT_PHONE_NONE]}>
      <PhoneSection />
    </AuthStub>
  ),
};
