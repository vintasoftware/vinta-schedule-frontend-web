'use client';

import * as React from 'react';
import { RotateCw, ShieldCheck, ShieldMinus, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
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
import { useTeamMembers, type TeamMember } from '@/hooks/team/use-team-members';
import {
  useDisableUser,
  useReactivateUser,
} from '@/hooks/team/use-disable-user';
import { useUpdateMemberRole } from '@/hooks/team/use-update-member-role';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and sibling modules can import them directly rather than
// duplicating the definitions (which would let them silently drift).
// ---------------------------------------------------------------------------

export const ROLE_VARIANT: Record<TeamMember['role'], 'default' | 'secondary'> =
  {
    admin: 'default',
    member: 'secondary',
  };

export const STATUS_VARIANT: Record<
  TeamMember['status'],
  'success' | 'danger'
> = {
  active: 'success',
  disabled: 'danger',
};

// Helper to create columns — accepts pendingRowIds (to disable actions for in-flight rows)
// and action handlers (onDisable, onReactivate). This allows the table to pass its local
// pending-row state down into the column cell renderer.
export function createColumns(
  pendingRowIds: Set<number>,
  onDisable: (member: TeamMember) => Promise<void>,
  onReactivate: (member: TeamMember) => Promise<void>,
  onChangeRole: (member: TeamMember, role: TeamMember['role']) => Promise<void>
): DataTableColumn<TeamMember>[] {
  return [
    {
      accessorKey: 'name',
      id: 'name',
      header: 'Name',
      // The /organization-members/ endpoint has no ordering param — disable sort.
      enableSorting: false,
      cell: ({ row }) => <Text weight='medium'>{row.original.name}</Text>,
    },
    {
      accessorKey: 'email',
      id: 'email',
      header: 'Email',
      enableSorting: false,
      cell: ({ row }) => (
        <Text color='muted-foreground'>{row.original.email}</Text>
      ),
    },
    {
      accessorKey: 'role',
      id: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={ROLE_VARIANT[row.original.role]}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={STATUS_VARIANT[row.original.status]}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <HStack gap={2}>
          {row.original.status === 'active' && (
            <ChangeRoleButton
              member={row.original}
              isLoading={pendingRowIds.has(row.original.id)}
              onChangeRole={onChangeRole}
            />
          )}
          {row.original.status === 'active' ? (
            <DisableButton
              member={row.original}
              isLoading={pendingRowIds.has(row.original.id)}
              onDisable={onDisable}
            />
          ) : (
            <ReactivateButton
              member={row.original}
              isLoading={pendingRowIds.has(row.original.id)}
              onReactivate={onReactivate}
            />
          )}
        </HStack>
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(
  new Set(),
  async () => {},
  async () => {},
  async () => {}
);

// ---------------------------------------------------------------------------
// DisableButton — per-row action to disable an active member
// ---------------------------------------------------------------------------

interface DisableButtonProps {
  member: TeamMember;
  isLoading: boolean;
  onDisable: (member: TeamMember) => Promise<void>;
}

function DisableButton({ member, isLoading, onDisable }: DisableButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onDisable(member);
    setDialogOpen(false);
  }, [member, onDisable]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Disable user ${member.name}`}
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Disabling…
          </>
        ) : (
          <>
            <UserX className='mr-1 size-4' aria-hidden />
            Disable
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disable{' '}
              <span className='font-medium'>{member.name}</span>? This user will
              lose access to the application on their next request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// ChangeRoleButton — per-row action to promote/demote a member's role.
// Roles are binary (member <-> admin) so the button toggles to the opposite of
// the current role behind a confirmation dialog.
// ---------------------------------------------------------------------------

interface ChangeRoleButtonProps {
  member: TeamMember;
  isLoading: boolean;
  onChangeRole: (member: TeamMember, role: TeamMember['role']) => Promise<void>;
}

function ChangeRoleButton({
  member,
  isLoading,
  onChangeRole,
}: ChangeRoleButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const nextRole: TeamMember['role'] =
    member.role === 'admin' ? 'member' : 'admin';
  const promoting = nextRole === 'admin';

  const handleConfirm = React.useCallback(async () => {
    await onChangeRole(member, nextRole);
    setDialogOpen(false);
  }, [member, nextRole, onChangeRole]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={
          promoting
            ? `Make ${member.name} an admin`
            : `Make ${member.name} a member`
        }
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Updating…
          </>
        ) : promoting ? (
          <>
            <ShieldCheck className='mr-1 size-4' aria-hidden />
            Make admin
          </>
        ) : (
          <>
            <ShieldMinus className='mr-1 size-4' aria-hidden />
            Make member
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {promoting ? 'Promote to admin' : 'Demote to member'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {promoting ? (
                <>
                  Are you sure you want to make{' '}
                  <span className='font-medium'>{member.name}</span> an admin?
                  Admins can manage members, billing, and organization settings.
                </>
              ) : (
                <>
                  Are you sure you want to change{' '}
                  <span className='font-medium'>{member.name}</span> to a
                  member? They will lose admin permissions.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {promoting ? 'Make admin' : 'Make member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// ReactivateButton — per-row action to re-enable a disabled member
// ---------------------------------------------------------------------------

interface ReactivateButtonProps {
  member: TeamMember;
  isLoading: boolean;
  onReactivate: (member: TeamMember) => Promise<void>;
}

function ReactivateButton({
  member,
  isLoading,
  onReactivate,
}: ReactivateButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onReactivate(member);
    setDialogOpen(false);
  }, [member, onReactivate]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Re-enable user ${member.name}`}
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Enabling…
          </>
        ) : (
          <>
            <RotateCw className='mr-1 size-4' aria-hidden />
            Re-enable
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-enable user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to re-enable{' '}
              <span className='font-medium'>{member.name}</span>? This user will
              regain access to the application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              Re-enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// TeamTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function TeamTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No team members found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// TeamTableInner — renders inside the DataTableQueryBoundary (needs useSearchParams).
// ---------------------------------------------------------------------------

function TeamTableInner() {
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );

  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const { members, totalCount, isLoading, isError, error } =
    useTeamMembers(query);

  const { disableUser } = useDisableUser();
  const { reactivateUser } = useReactivateUser();
  const { updateMemberRole } = useUpdateMemberRole();

  // Handle disable action: track in-flight row, call hook, show toast, update state.
  const handleDisable = React.useCallback(
    async (member: TeamMember) => {
      // Mark this row as pending to disable its buttons.
      setPendingRowIds((prev) => new Set(prev).add(member.id));

      try {
        await disableUser(member.id);
        toast.success('User disabled', {
          description: `${member.name} has been disabled and will lose access on their next request.`,
        });
      } catch (err) {
        toast.error('Failed to disable user', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      }
    },
    [disableUser]
  );

  // Handle reactivate action: track in-flight row, call hook, show toast.
  const handleReactivate = React.useCallback(
    async (member: TeamMember) => {
      // Mark this row as pending to disable its buttons.
      setPendingRowIds((prev) => new Set(prev).add(member.id));

      try {
        await reactivateUser(member.id);
        toast.success('User re-enabled', {
          description: `${member.name} has been re-enabled and can access the application again.`,
        });
      } catch (err) {
        toast.error('Failed to re-enable user', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      }
    },
    [reactivateUser]
  );

  // Handle role change: track in-flight row, call hook, show toast.
  const handleChangeRole = React.useCallback(
    async (member: TeamMember, role: TeamMember['role']) => {
      setPendingRowIds((prev) => new Set(prev).add(member.id));

      try {
        await updateMemberRole(member.id, role);
        toast.success('Role updated', {
          description: `${member.name} is now ${role === 'admin' ? 'an admin' : 'a member'}.`,
        });
      } catch (err) {
        toast.error('Failed to update role', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      }
    },
    [updateMemberRole]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load team members.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const columns = createColumns(
    pendingRowIds,
    handleDisable,
    handleReactivate,
    handleChangeRole
  );

  return (
    <DataTable<TeamMember>
      data={members}
      columns={columns}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<TeamTableEmpty />}
      showSearch={false}
    />
  );
}

// ---------------------------------------------------------------------------
// TeamTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// TeamTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function TeamTable() {
  return <TeamTableInner />;
}
