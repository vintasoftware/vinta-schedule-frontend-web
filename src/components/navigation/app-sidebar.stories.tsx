import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppSidebar } from './app-sidebar';
import { RoleProvider } from './role-gate';

const meta = {
  title: 'Composition/AppSidebar',
  component: AppSidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// The sidebar always appends the Billing section. The admin-only Ledger entry is
// gated on the role from RoleProvider, so each story sets a role to show which
// billing items that role sees.
export const Default: Story = {
  render: function Render() {
    const [active, setActive] = React.useState('calendar');
    return (
      <RoleProvider role='admin'>
        <div className='h-screen'>
          <AppSidebar activeId={active} onNavigate={setActive} />
        </div>
      </RoleProvider>
    );
  },
};

export const MemberBilling: Story = {
  name: 'Member (no billing Ledger)',
  render: function Render() {
    const [active, setActive] = React.useState('calendar');
    return (
      <RoleProvider role='member'>
        <div className='h-screen'>
          <AppSidebar activeId={active} onNavigate={setActive} />
        </div>
      </RoleProvider>
    );
  },
};
