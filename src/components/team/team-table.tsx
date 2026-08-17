'use client';

import * as React from 'react';
import { RotateCw, ShieldCheck, ShieldMinus, UserX } from 'lucide-react';
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
import type { GroupsEnum } from '@/client';
import { useTeamMembers, type TeamMember } from '@/hooks/team/use-team-members';
import {
  useDisableUser,
  useReactivateUser,
} from '@/hooks/team/use-disable-user';
import { useSetMemberGroups } from '@/hooks/team/use-set-member-groups';
import {
  PERMISSIONS,
  membershipLabel,
} from '@/components/navigation/permission-gate';

// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and sibling modules can import them directly rather than
// duplicating the definitions (which would let them silently drift).
// ---------------------------------------------------------------------------

// A member's standing is derived from its capabilities, not a `role` field:
// `manage_members` reads as "Admin", `manage_billing` (alone) as "Billing",
// anyone else as "Member". See `membershipLabel`.
export const STANDING_VARIANT: Record<
  ReturnType<typeof membershipLabel>,
  'default' | 'secondary'
> = {
  Admin: 'default',
  Billing: 'secondary',
  Member: 'secondary',
};

/** Whether a member holds the member-management capability (the old "admin"). */
function canManageMembers(member: TeamMember): boolean {
  return member.permissions.includes(PERMISSIONS.manageMembers);
}

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
  onSetGroups: (member: TeamMember, groups: GroupsEnum[]) => Promise<void>
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
      accessorKey: 'permissions',
      id: 'role',
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => {
        const standing = membershipLabel(row.original.permissions);
        return <Badge variant={STANDING_VARIANT[standing]}>{standing}</Badge>;
      },
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
              onSetGroups={onSetGroups}
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
            <Spinner label='' />
            Disabling…
          </>
        ) : (
          <>
            <UserX aria-hidden />
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
              <Text weight='medium'>{member.name}</Text>? This user will lose
              access to the application on their next request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              variant='destructive'
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
// ChangeRoleButton — per-row action to promote/demote a member.
// The control is binary (member <-> admin), so it toggles to the opposite of
// the member's current standing behind a confirmation dialog. "Make admin"
// assigns the `organization_admin` group; "Make member" assigns
// `organization_member` (which carries no capabilities), stripping any
// elevated access the member held.
// ---------------------------------------------------------------------------

interface ChangeRoleButtonProps {
  member: TeamMember;
  isLoading: boolean;
  onSetGroups: (member: TeamMember, groups: GroupsEnum[]) => Promise<void>;
}

function ChangeRoleButton({
  member,
  isLoading,
  onSetGroups,
}: ChangeRoleButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const promoting = !canManageMembers(member);

  const handleConfirm = React.useCallback(async () => {
    await onSetGroups(
      member,
      promoting ? ['organization_admin'] : ['organization_member']
    );
    setDialogOpen(false);
  }, [member, promoting, onSetGroups]);

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
            <Spinner label='' />
            Updating…
          </>
        ) : promoting ? (
          <>
            <ShieldCheck aria-hidden />
            Make admin
          </>
        ) : (
          <>
            <ShieldMinus aria-hidden />
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
                  <Text weight='medium'>{member.name}</Text> an admin? Admins
                  can manage members, billing, and organization settings.
                </>
              ) : (
                <>
                  Are you sure you want to change{' '}
                  <Text weight='medium'>{member.name}</Text> to a member? They
                  will lose admin permissions.
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
            <Spinner label='' />
            Enabling…
          </>
        ) : (
          <>
            <RotateCw aria-hidden />
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
              <Text weight='medium'>{member.name}</Text>? This user will regain
              access to the application.
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
  const { setMemberGroups } = useSetMemberGroups();

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

  // Handle standing change: track in-flight row, call hook, show toast.
  const handleSetGroups = React.useCallback(
    async (member: TeamMember, groups: GroupsEnum[]) => {
      setPendingRowIds((prev) => new Set(prev).add(member.id));

      const promotedToAdmin = groups.includes('organization_admin');
      try {
        await setMemberGroups(member.id, groups);
        toast.success('Role updated', {
          description: `${member.name} is now ${promotedToAdmin ? 'an admin' : 'a member'}.`,
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
    [setMemberGroups]
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
    handleSetGroups
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
