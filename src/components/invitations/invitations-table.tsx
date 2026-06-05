'use client';

import * as React from 'react';
import { UserPlus } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VStack, Text } from '@/components/layout';
import { DateTime, zonedFormat } from '@/lib/datetime';
import {
  useInvitations,
  type Invitation,
} from '@/hooks/invitations/use-invitations';
import { InviteMemberDialog } from './invite-member-dialog';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and sibling modules can import them directly rather than
// duplicating the definitions (which would let them silently drift).
// ---------------------------------------------------------------------------

/** Get the viewer's local IANA zone name (e.g. "America/New_York"). */
function localZone(): string {
  return DateTime.local().zoneName ?? 'UTC';
}

export const COLUMNS: DataTableColumn<Invitation>[] = [
  {
    accessorKey: 'email',
    id: 'email',
    header: 'Email',
    // The /invitations/ endpoint has no ordering param — disable sort.
    enableSorting: false,
    cell: ({ row }) => <Text weight='medium'>{row.original.email}</Text>,
  },
  {
    accessorKey: 'expiresAt',
    id: 'expiresAt',
    header: 'Expires',
    enableSorting: false,
    cell: ({ row }) => (
      <Text color='muted-foreground' size='sm'>
        {zonedFormat(row.original.expiresAt, localZone(), 'MMM d, yyyy')}
      </Text>
    ),
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: 'Status',
    enableSorting: false,
    // All rows in this table are pending (hook always filters is_accepted: false).
    cell: () => <Badge variant='info'>pending</Badge>,
  },
];

// ---------------------------------------------------------------------------
// INV_URL_PREFIX
//
// URL param prefix for the invitations table so its pagination/search state
// is independent from the team members table on the same /team route.
// With this prefix the keys are: inv_page, inv_page_size, inv_ordering,
// inv_search — distinct from the unprefixed team table keys.
// ---------------------------------------------------------------------------

export const INV_URL_PREFIX = 'inv';

// ---------------------------------------------------------------------------
// InvitationsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function InvitationsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No pending invitations.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// InvitationsTableInner — renders inside the DataTableQueryBoundary (needs useSearchParams).
// ---------------------------------------------------------------------------

function InvitationsTableInner() {
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const { query, setPage, setSearch, setOrdering } = useDataTableQuery({
    prefix: INV_URL_PREFIX,
  });

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { invitations, totalCount, isLoading, isError, error } =
    useInvitations(query);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load invitations.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const toolbarActions = (
    <Button size='sm' onClick={() => setInviteOpen(true)}>
      <UserPlus className='size-4' aria-hidden />
      Invite member
    </Button>
  );

  return (
    <>
      <DataTable<Invitation>
        data={invitations}
        columns={COLUMNS}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<InvitationsTableEmpty />}
        showSearch={true}
        toolbarActions={toolbarActions}
      />
      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// InvitationsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// InvitationsTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function InvitationsTable() {
  return <InvitationsTableInner />;
}
