'use client';

import * as React from 'react';
import { UserPlus, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'vinta-schedule-design-system/ui/alert-dialog';
import { VStack, Text, HStack } from 'vinta-schedule-design-system/layout';
import { DateTime, zonedFormat } from '@/lib/datetime';
import {
  useInvitations,
  type Invitation,
} from '@/hooks/invitations/use-invitations';
import { useResendInvitation } from '@/hooks/invitations/use-resend-invitation';
import { useRevokeInvitation } from '@/hooks/invitations/use-revoke-invitation';
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

// Helper to create columns — accepts pendingRowIds (to disable actions for in-flight
// rows), onResend, and onRevoke (row action handlers). This allows the table to pass
// its local pending-row state down into the column cell renderer.
export function createColumns(
  pendingRowIds: Set<number>,
  onResend: (row: Invitation) => Promise<void>,
  onRevoke: (row: Invitation) => Promise<void>
): DataTableColumn<Invitation>[] {
  return [
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
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2}>
          <ResendButton
            invitation={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onResend={onResend}
          />
          <RevokeButton
            invitation={row.original}
            isLoading={pendingRowIds.has(row.original.id)}
            onRevoke={onRevoke}
          />
        </HStack>
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(
  new Set(),
  async () => {},
  async () => {}
);

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
// ResendButton — per-row action to resend an invitation
// ---------------------------------------------------------------------------

interface ResendButtonProps {
  invitation: Invitation;
  isLoading: boolean;
  onResend: (invitation: Invitation) => Promise<void>;
}

function ResendButton({ invitation, isLoading, onResend }: ResendButtonProps) {
  return (
    <Button
      size='sm'
      variant='outline'
      onClick={() => onResend(invitation)}
      disabled={isLoading}
      aria-label={`Resend invitation to ${invitation.email}`}
    >
      {isLoading ? (
        <>
          <Spinner label='' />
          Resending…
        </>
      ) : (
        <>
          <RotateCw aria-hidden />
          Resend
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// RevokeButton — per-row action to revoke an invitation with confirmation
// ---------------------------------------------------------------------------

interface RevokeButtonProps {
  invitation: Invitation;
  isLoading: boolean;
  onRevoke: (invitation: Invitation) => Promise<void>;
}

function RevokeButton({ invitation, isLoading, onRevoke }: RevokeButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onRevoke(invitation);
    setDialogOpen(false);
  }, [invitation, onRevoke]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Revoke invitation to ${invitation.email}`}
      >
        {isLoading ? (
          <>
            <Spinner label='' />
            Revoking…
          </>
        ) : (
          <>
            <Trash2 aria-hidden />
            Revoke
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{' '}
              <Text weight='medium'>{invitation.email}</Text>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              variant='destructive'
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );

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

  const { resendInvitation } = useResendInvitation();
  const { revokeInvitation } = useRevokeInvitation();

  // Handle resend action: track in-flight row, call hook, show toast, update state.
  const handleResend = React.useCallback(
    async (invitation: Invitation) => {
      // Mark this row as pending to disable its buttons.
      setPendingRowIds((prev) => new Set(prev).add(invitation.id));

      try {
        await resendInvitation(invitation.id, invitation.email);
        toast.success('Invitation resent', {
          description: `The invitation to ${invitation.email} was resent.`,
        });
      } catch (err) {
        toast.error('Failed to resend invitation', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(invitation.id);
          return next;
        });
      }
    },
    [resendInvitation]
  );

  // Handle revoke action: track in-flight row, call hook, show toast.
  // The row is removed by invalidation after the mutation succeeds.
  const handleRevoke = React.useCallback(
    async (invitation: Invitation) => {
      // Mark this row as pending to disable its buttons.
      setPendingRowIds((prev) => new Set(prev).add(invitation.id));

      try {
        await revokeInvitation(invitation.id);
        toast.success('Invitation revoked', {
          description: `The invitation to ${invitation.email} was revoked.`,
        });
      } catch (err) {
        toast.error('Failed to revoke invitation', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        // Note: on success, the row is removed by invalidation, so this cleanup
        // is mainly for error cases.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(invitation.id);
          return next;
        });
      }
    },
    [revokeInvitation]
  );

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
      <UserPlus aria-hidden />
      Invite member
    </Button>
  );

  const columns = createColumns(pendingRowIds, handleResend, handleRevoke);

  return (
    <>
      <DataTable<Invitation>
        data={invitations}
        columns={columns}
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
