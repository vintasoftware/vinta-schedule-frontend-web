'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from '@vinta-schedule/design-system/layout';
import type { Invitation } from '@/hooks/invitations/use-invitations';
// Import canonical column factory from the component so they can't drift.
import { createColumns } from './invitations-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_INVITATIONS: Invitation[] = [
  {
    id: 1,
    email: 'alice@acme.com',
    expiresAt: '2025-12-31T23:59:59Z',
    status: 'pending',
  },
  {
    id: 2,
    email: 'bob@acme.com',
    expiresAt: '2025-12-25T23:59:59Z',
    status: 'pending',
  },
  {
    id: 3,
    email: 'carol@acme.com',
    expiresAt: '2025-12-20T23:59:59Z',
    status: 'pending',
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — uses plain useState (no useSearchParams) so no router needed.
// Drives DataTable directly with data/isLoading/totalCount props.
// ---------------------------------------------------------------------------

function InvitationsTableStory({
  data = ALL_INVITATIONS,
  totalCount,
  isLoading = false,
}: {
  data?: Invitation[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 10,
  });
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No pending invitations.
      </Text>
    </VStack>
  );

  // Story-only mock resend handler: mark as pending, toast, then clear.
  const handleResend = React.useCallback(async (invitation: Invitation) => {
    setPendingRowIds((prev) => new Set(prev).add(invitation.id));
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
    toast.success('Invitation resent', {
      description: `The invitation to ${invitation.email} was resent.`,
    });
    setPendingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(invitation.id);
      return next;
    });
  }, []);

  // Story-only mock revoke handler: mark as pending, toast, then clear.
  const handleRevoke = React.useCallback(async (invitation: Invitation) => {
    setPendingRowIds((prev) => new Set(prev).add(invitation.id));
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
    toast.success('Invitation revoked', {
      description: `The invitation to ${invitation.email} was revoked.`,
    });
    setPendingRowIds((prev) => {
      const next = new Set(prev);
      next.delete(invitation.id);
      return next;
    });
  }, []);

  const columns = createColumns(pendingRowIds, handleResend, handleRevoke);

  return (
    <div className='p-6'>
      <DataTable<Invitation>
        data={data}
        columns={columns}
        query={query}
        onQueryChange={setQuery}
        totalCount={count}
        isLoading={isLoading}
        emptyState={empty}
        showSearch={true}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Invitations/InvitationsTable',
  component: InvitationsTableStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof InvitationsTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Populated — three pending invitations with email, expiry, and status badge. */
export const Populated: Story = {
  render: () => <InvitationsTableStory />,
};

/** Empty — no pending invitations; custom empty-state is visible. */
export const Empty: Story = {
  render: () => <InvitationsTableStory data={[]} totalCount={0} />,
};

/** Loading — skeleton rows while data is fetching. */
export const Loading: Story = {
  render: () => <InvitationsTableStory data={[]} isLoading />,
};
