import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RoleProvider, RoleGate } from './role-gate';
import { Badge } from '@/components/ui/badge';
import { Stack } from '@/components/layout/stack';
import { Text } from '@/components/layout/text';
import { Heading } from '@/components/layout/heading';

const meta: Meta = {
  title: 'Navigation/RoleGate',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

function NavItem({ label, adminOnly }: { label: string; adminOnly?: boolean }) {
  return (
    <div className='bg-sidebar-accent text-sidebar-accent-foreground flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium'>
      <span className='flex-1'>{label}</span>
      {adminOnly && (
        <Badge variant='info' className='text-[10px]'>
          admin
        </Badge>
      )}
    </div>
  );
}

function NavSection({ role }: { role: 'admin' | 'member' | null }) {
  return (
    <RoleProvider role={role}>
      <Stack
        gap={4}
        className='border-border bg-sidebar w-56 rounded-xl border p-4'
      >
        <Stack gap={1}>
          <Text
            weight='semibold'
            uppercase
            color='muted-foreground'
            className='px-2 text-[11px] tracking-wider'
          >
            Navigation
          </Text>
          <NavItem label='Dashboard' />
          <NavItem label='My Calendars' />
          <NavItem label='Events' />
        </Stack>

        <RoleGate role='admin'>
          <Stack gap={1}>
            <Text
              weight='semibold'
              uppercase
              color='muted-foreground'
              className='px-2 text-[11px] tracking-wider'
            >
              Admin
            </Text>
            <NavItem label='Team' adminOnly />
            <NavItem label='All Calendars' adminOnly />
            <NavItem label='API Tokens' adminOnly />
          </Stack>
        </RoleGate>
      </Stack>
    </RoleProvider>
  );
}

export const AdminRole: Story = {
  name: 'Admin — sees admin section',
  render: () => (
    <Stack gap={3}>
      <Heading level={3} size='sm'>
        Role: <code>admin</code>
      </Heading>
      <NavSection role='admin' />
    </Stack>
  ),
};

export const MemberRole: Story = {
  name: 'Member — admin section hidden',
  render: () => (
    <Stack gap={3}>
      <Heading level={3} size='sm'>
        Role: <code>member</code>
      </Heading>
      <NavSection role='member' />
    </Stack>
  ),
};

export const NullRole: Story = {
  name: 'Loading (null role) — admin section hidden',
  render: () => (
    <Stack gap={3}>
      <Heading level={3} size='sm'>
        Role: <code>null</code> (loading)
      </Heading>
      <NavSection role={null} />
    </Stack>
  ),
};

export const WithFallback: Story = {
  name: 'RoleGate with fallback',
  render: () => (
    <RoleProvider role='member'>
      <Stack gap={4} className='border-border w-56 rounded-xl border p-4'>
        <Text weight='medium'>Restricted area:</Text>
        <RoleGate
          role='admin'
          fallback={
            <div className='border-border bg-muted text-muted-foreground rounded-md border px-3 py-2 text-sm'>
              You need admin access to view this.
            </div>
          }
        >
          <div className='bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm'>
            Admin-only content
          </div>
        </RoleGate>
      </Stack>
    </RoleProvider>
  ),
};
