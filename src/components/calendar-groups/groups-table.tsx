'use client';

import * as React from 'react';
import Link from 'next/link';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { TextLink } from 'vinta-schedule-design-system/ui/text-link';
import { Plus } from 'lucide-react';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useCalendarGroups,
  type CalendarGroup,
} from '@/hooks/calendar-groups/use-calendar-groups';
import { useOwnedCalendarIds } from '@/hooks/calendars/use-owned-calendar-ids';
import { useRole } from '@/components/navigation/role-gate';
import { CreateGroupDialog } from './create-group-dialog';

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
  // phase. Members see only groups containing a calendar they own — and
  // get neither the create action nor the create dialog, since creating a
  // group is an admin roster task this page never offers a member a
  // control for (Non-goals, plan §1: editing groups/slots/rosters).
  const role = useRole();
  const isMember = role === 'member';
  const { ownedCalendarIds, isLoading: isOwnedCalendarsLoading } =
    useOwnedCalendarIds({ enabled: isMember });

  const {
    groups: fetchedGroups,
    totalCount: fetchedTotalCount,
    isLoading: isGroupsLoading,
    isError,
    error,
  } = useCalendarGroups({ query });

  const groups = isMember
    ? fetchedGroups.filter((group) =>
        groupHasOwnedCalendar(group, ownedCalendarIds)
      )
    : fetchedGroups;

  // For a member, totalCount reflects only the filtered rows on the
  // currently-fetched page, not a true count across every page — an
  // accepted approximation for the client-side filter (see
  // groupHasOwnedCalendar above); a member's group count is expected to be
  // small in practice.
  const totalCount = isMember ? groups.length : fetchedTotalCount;
  const isLoading = isGroupsLoading || (isMember && isOwnedCalendarsLoading);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendar groups.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const toolbarActions = isMember ? undefined : (
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
      {!isMember && (
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
