import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RecoveryCodesDialog } from './recovery-codes-dialog';
import { AuthStub, RECOVERY_CODES, type StubHandler } from './story-fixtures';

const NO_CODES_LEFT: StubHandler = [
  '/account/authenticators/recovery-codes',
  {
    status: 200,
    data: {
      type: 'recovery_codes',
      created_at: 1718000000,
      total_code_count: 10,
      unused_code_count: 0,
      unused_codes: [],
    },
  },
];

const meta = {
  title: 'Components/AccountSecurity/RecoveryCodesDialog',
  component: RecoveryCodesDialog,
  parameters: { layout: 'centered' },
  args: {
    open: true,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof RecoveryCodesDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithCodes: Story = {
  render: (args) => (
    <AuthStub handlers={[RECOVERY_CODES]}>
      <RecoveryCodesDialog {...args} />
    </AuthStub>
  ),
};

/** All codes spent — prompts regeneration. */
export const Exhausted: Story = {
  render: (args) => (
    <AuthStub handlers={[NO_CODES_LEFT]}>
      <RecoveryCodesDialog {...args} />
    </AuthStub>
  ),
};
