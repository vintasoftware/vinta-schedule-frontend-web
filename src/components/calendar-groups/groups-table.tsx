'use client';

import * as React from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type {
  DataTableColumn,
  DataTableQuery,
} from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { Link2, Pencil, Plus } from 'lucide-react';
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useCalendarGroups,
  type CalendarGroup,
} from '@/hooks/calendar-groups/use-calendar-groups';
import {
  useOwnedCalendarIds,
  OWNED_CALENDARS_PAGE_SIZE,
} from '@/hooks/calendars/use-owned-calendar-ids';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { canMintBookingLinkForGroup } from '@/lib/booking-links/can-mint-booking-link';
import { MintBookingLinkDialog } from '@/components/booking-links/mint-booking-link-dialog';
import { CreateGroupDialog } from './create-group-dialog';
import { EditGroupDialog } from './edit-group-dialog';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and tests can import them directly.
// ---------------------------------------------------------------------------

export const COLUMNS: DataTableColumn<CalendarGroup>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => (
      // className is an escape hatch here because TextLink has no `weight`
      // variant yet — add one instead of copying this one-off class.
      <TextLink asChild className='font-medium'>
        <Link href={`/groups/${row.original.id}`}>{row.original.name}</Link>
      </TextLink>
    ),
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: 'Description',
    enableSorting: false,
    cell: ({ row }) => (
      <Text color='muted-foreground' size='sm'>
        {row.original.description || '—'}
      </Text>
    ),
  },
  {
    accessorKey: 'slots',
    id: 'slots',
    header: 'Slots',
    enableSorting: false,
    cell: ({ row }) => (
      <Badge variant='secondary'>{row.original.slots.length}</Badge>
    ),
  },
  {
    id: 'pools',
    header: 'Pools',
    enableSorting: false,
    cell: ({ row }) => {
      const names = distinctPoolNames(row.original);
      return names.length === 0 ? (
        <Text color='muted-foreground' size='sm'>
          —
        </Text>
      ) : (
        <HStack gap={1} wrap>
          {names.map((name) => (
            <Badge key={name} variant='outline'>
              {name}
            </Badge>
          ))}
        </HStack>
      );
    },
  },
];

// A pool can be attached to more than one slot of the same group; the column
// names each pool once rather than repeating it per slot.
function distinctPoolNames(group: CalendarGroup): string[] {
  return [
    ...new Set(group.slots.flatMap((slot) => slot.pools.map((p) => p.name))),
  ];
}

// ---------------------------------------------------------------------------
// groupHasOwnedCalendar — true when any slot in the group's roster contains
// a calendar the caller owns. Drives the member-scoped list (Phase 2):
// members see only groups they can actually act on, admins see all.
//
// Defense in depth: this filters client-side regardless of whether the
// list endpoint already scopes results to a member's own groups server
// side (Open Question 1 in the plan) — so the visible list is never wider
// than "groups containing something this viewer owns", independent of
// what the backend returns.
// ---------------------------------------------------------------------------

function groupHasOwnedCalendar(
  group: CalendarGroup,
  ownedCalendarIds: ReadonlySet<number>
): boolean {
  return group.slots.some((slot) =>
    slot.calendars.some((calendar) => ownedCalendarIds.has(calendar.id))
  );
}

/** Every calendar id anywhere in a group's slot roster. */
function groupCalendarIds(group: CalendarGroup): number[] {
  return group.slots.flatMap((slot) => slot.calendars.map((c) => c.id));
}

// ---------------------------------------------------------------------------
// RowActions — the per-row action cell.
//
// Two independent affordances, each gated by its own rule: "Get link" for a
// viewer the owner-or-org-admin predicate allows (a UI affordance only — the
// server re-checks the real rule at mint time regardless, see
// can-mint-booking-link.ts), and "Edit" for an org admin, matching the API
// where every group-shape write (slots, rosters, pool attachments) is
// admin-only.
//
// Renders null rather than an empty container when a viewer gets neither, so a
// denied row has no stray action cell.
//
// Deliberately stateless: the columns array is rebuilt on every render, which
// remounts these cells — anything stateful belongs in GroupsTableInner.
// ---------------------------------------------------------------------------

interface RowActionsProps {
  group: CalendarGroup;
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
  onMint: (group: CalendarGroup) => void;
  onEdit: (group: CalendarGroup) => void;
}

function RowActions({
  group,
  permissions,
  ownedCalendarIds,
  onMint,
  onEdit,
}: RowActionsProps) {
  const canMint = canMintBookingLinkForGroup({
    permissions,
    ownedCalendarIds,
    groupCalendarIds: groupCalendarIds(group),
  });
  const canEdit = permissions?.includes(PERMISSIONS.manageMembers) ?? false;

  if (!canMint && !canEdit) return null;

  return (
    <HStack gap={2}>
      {canMint ? (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onMint(group)}
          aria-label={`Get scheduling link for ${group.name}`}
        >
          <Link2 aria-hidden />
          Get link
        </Button>
      ) : null}
      {canEdit ? (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(group)}
          aria-label={`Edit group ${group.name}`}
        >
          <Pencil aria-hidden />
          Edit
        </Button>
      ) : null}
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// createColumns — COLUMNS plus a permission-gated "actions" column. COLUMNS
// itself stays a static 3-column export for backward compatibility (existing
// tests import it directly); this factory is what the live table actually
// renders, so per-row mint access can react to the resolved permissions and
// ownership set. Exported so the story renders the same 4-column set the
// live table does, and so its "actions" cell can be unit-tested directly for
// the denied case, which is unreachable through the rendered table (see
// groups-table.test.tsx).
// ---------------------------------------------------------------------------

export function createColumns(
  permissions: readonly string[] | null,
  ownedCalendarIds: ReadonlySet<number>,
  onMint: (group: CalendarGroup) => void,
  onEdit: (group: CalendarGroup) => void
): DataTableColumn<CalendarGroup>[] {
  return [
    ...COLUMNS,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          group={row.original}
          permissions={permissions}
          ownedCalendarIds={ownedCalendarIds}
          onMint={onMint}
          onEdit={onEdit}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// GroupsTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function GroupsTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendar groups found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// GroupsTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function GroupsTableInner() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [mintTarget, setMintTarget] = React.useState<CalendarGroup | null>(
    null
  );
  const [editing, setEditing] = React.useState<CalendarGroup | null>(null);
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  // Admins see every group in the organization, unchanged from before this
  // phase. Everyone else — members, and the null (not-yet-resolved) permission
  // set — sees only groups containing a calendar they own, and gets neither the
  // create action nor the create dialog, since creating a group is an admin
  // roster task this page never offers a member a control for (Non-goals,
  // plan §1: editing groups/slots/rosters). Gating on `isAdmin` (rather than
  // `isMember`) means an unresolved or unknown permission set fails CLOSED into
  // the scoped branch instead of falling open into admin chrome.
  const permissions = usePermissions();
  const isAdmin = permissions?.includes(PERMISSIONS.manageMembers) ?? false;
  const {
    ownedCalendarIds,
    isLoading: isOwnedCalendarsLoading,
    isError: isOwnedCalendarsError,
    refetch: refetchOwnedCalendars,
  } = useOwnedCalendarIds({ enabled: !isAdmin });

  // Non-admins fetch a single large page (offset 0, a limit mirroring
  // useOwnedCalendarIds' own page size) instead of the URL-driven page/size,
  // because server-side pagination happens BEFORE the ownership filter runs
  // below — paginating server-side first would pin a member to whichever
  // page their one owned group happens to land on, in an org with more
  // groups than one page (BLOCKER 2, phase 2 review). It is the org's total
  // group count that drives that risk, not the member's.
  const nonAdminQuery: DataTableQuery = {
    page: 1,
    pageSize: OWNED_CALENDARS_PAGE_SIZE,
    ordering: query.ordering,
    search: query.search,
  };

  const {
    groups: fetchedGroups,
    totalCount: fetchedTotalCount,
    isLoading: isGroupsLoading,
    isError,
    error,
  } = useCalendarGroups({ query: isAdmin ? query : nonAdminQuery });

  const filteredGroups = isAdmin
    ? fetchedGroups
    : fetchedGroups.filter((group) =>
        groupHasOwnedCalendar(group, ownedCalendarIds)
      );

  // For a member, totalCount is the TRUE filtered count — the fetch above
  // already pulled every group the org has (up to the large-page limit) in
  // one request, so the filter isn't operating on a single server page.
  const totalCount = isAdmin ? fetchedTotalCount : filteredGroups.length;

  // Client-side pagination of the filtered rows, driven by the URL's
  // page/pageSize — DataTable itself never paginates client-side, so this
  // slice has to happen here for the non-admin branch.
  const groups = isAdmin
    ? filteredGroups
    : filteredGroups.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize
      );

  // A null (not yet resolved) permission set must never render admin chrome or
  // fetched-but-unfiltered data — hold the table in its loading state until
  // we know which branch applies.
  const isLoading =
    permissions === null ||
    isGroupsLoading ||
    (!isAdmin && isOwnedCalendarsLoading);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendar groups.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {getApiErrorMessage(error, 'An unexpected error occurred.')}
        </Text>
      </VStack>
    );
  }

  // A member whose ownership check failed must not silently degrade into
  // "No calendar groups found." — that's indistinguishable from genuinely
  // owning nothing. Surface the failure and offer a retry instead.
  if (!isAdmin && isOwnedCalendarsError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Couldn&apos;t check which calendars you own.
        </Text>
        <Button size='sm' variant='outline' onClick={refetchOwnedCalendars}>
          Retry
        </Button>
      </VStack>
    );
  }

  // Members get the read-only column set; only an admin gets the Edit action.
  const toolbarActions = !isAdmin ? undefined : (
    <Button
      size='sm'
      onClick={() => setCreateDialogOpen(true)}
      data-testid='new-group-button'
    >
      <Plus />
      New group
    </Button>
  );

  const columns = createColumns(
    permissions,
    ownedCalendarIds,
    setMintTarget,
    setEditing
  );

  return (
    <>
      <DataTable<CalendarGroup>
        data={groups}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<GroupsTableEmpty />}
        showSearch={true}
        toolbarActions={toolbarActions}
      />
      {isAdmin && (
        <>
          <CreateGroupDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
          <EditGroupDialog
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            group={editing}
          />
        </>
      )}
      {mintTarget && (
        <MintBookingLinkDialog
          open={mintTarget !== null}
          onOpenChange={(open) => {
            if (!open) setMintTarget(null);
          }}
          target={{
            kind: 'group',
            id: mintTarget.id,
            name: mintTarget.name,
            duration: mintTarget.duration,
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// GroupsTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function GroupsTable() {
  return <GroupsTableInner />;
}
