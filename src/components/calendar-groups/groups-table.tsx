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
import { Plus } from 'lucide-react';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
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
import { CreateGroupDialog } from './create-group-dialog';

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
];

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

  return (
    <>
      <DataTable<CalendarGroup>
        data={groups}
        columns={COLUMNS}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<GroupsTableEmpty />}
        showSearch={true}
        toolbarActions={toolbarActions}
      />
      {isAdmin && (
        <CreateGroupDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
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
