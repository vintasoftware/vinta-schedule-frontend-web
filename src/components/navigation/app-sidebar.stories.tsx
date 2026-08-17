import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { AppSidebar } from './app-sidebar';
import { PermissionProvider, PERMISSIONS } from './permission-gate';

// Capability arrays standing in for the old 'admin' / 'member' roles.
const ADMIN_PERMISSIONS = [
  PERMISSIONS.manageMembers,
  PERMISSIONS.manageOrganization,
  PERMISSIONS.manageBranding,
  PERMISSIONS.manageBilling,
];
const MEMBER_PERMISSIONS: string[] = [];

const meta = {
  title: 'Composition/AppSidebar',
  component: AppSidebar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

// The sidebar always appends the Billing section. The admin-only Ledger entry is
// gated on the permissions from PermissionProvider, so each story sets a
// capability set to show which billing items that member sees.
export const Default: Story = {
  render: function Render() {
    const [active, setActive] = React.useState('calendar');
    return (
      <PermissionProvider permissions={ADMIN_PERMISSIONS}>
        <div className='h-screen'>
          <AppSidebar activeId={active} onNavigate={setActive} />
        </div>
      </PermissionProvider>
    );
  },
};

export const MemberBilling: Story = {
  name: 'Member (no billing Ledger)',
  render: function Render() {
    const [active, setActive] = React.useState('calendar');
    return (
      <PermissionProvider permissions={MEMBER_PERMISSIONS}>
        <div className='h-screen'>
          <AppSidebar activeId={active} onNavigate={setActive} />
        </div>
      </PermissionProvider>
    );
  },
};
