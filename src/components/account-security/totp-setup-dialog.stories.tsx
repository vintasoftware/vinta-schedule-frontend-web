import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TotpSetupDialog } from './totp-setup-dialog';
import { AuthStub } from './story-fixtures';

const SETUP_DATA = {
  secret: 'JBSWY3DPEHPK3PXP',
  totp_url:
    'otpauth://totp/Vinta%20Schedule:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Vinta%20Schedule',
};

const meta = {
  title: 'Components/AccountSecurity/TotpSetupDialog',
  component: TotpSetupDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onOpenChange: () => {},
    setupData: SETUP_DATA,
    onActivated: () => {},
  },
} satisfies Meta<typeof TotpSetupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** QR + manual secret + first-code confirmation. */
export const Open: Story = {
  render: (args) => (
    <AuthStub handlers={[]}>
      <TotpSetupDialog {...args} />
    </AuthStub>
  ),
};
