import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { SecurityPage } from './security-page';
import { AuthStub, DEFAULT_HANDLERS } from './story-fixtures';

const meta = {
  title: 'Components/AccountSecurity/SecurityPage',
  component: SecurityPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SecurityPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full /security screen with every section populated. */
export const Populated: Story = {
  render: () => (
    <AuthStub handlers={DEFAULT_HANDLERS}>
      <div className='p-6'>
        <SecurityPage />
      </div>
    </AuthStub>
  ),
};

export const Mobile: Story = {
  ...Populated,
  globals: { viewport: { value: 'mobile' } },
};
