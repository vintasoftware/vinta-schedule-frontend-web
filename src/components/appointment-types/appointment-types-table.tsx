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
  useAppointmentTypes,
  type AppointmentType,
} from '@/hooks/appointment-types/use-appointment-types';
import {
  useOwnedCalendarIds,
  OWNED_CALENDARS_PAGE_SIZE,
} from '@/hooks/calendars/use-owned-calendar-ids';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { canMintBookingLinkForAppointmentType } from '@/lib/booking-links/can-mint-booking-link';
import { MintBookingLinkDialog } from '@/components/booking-links/mint-booking-link-dialog';
import { CreateAppointmentTypeDialog } from './create-appointment-type-dialog';
import { EditAppointmentTypeDialog } from './edit-appointment-type-dialog';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
// ---------------------------------------------------------------------------
// Column definitions
// Exported so stories and tests can import them directly.
// ---------------------------------------------------------------------------

export const COLUMNS: DataTableColumn<AppointmentType>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: false,
    cell: ({ row }) => (
      // className is an escape hatch here because TextLink has no `weight`
      // variant yet — add one instead of copying this one-off class.
      <TextLink asChild className='font-medium'>
        <Link href={`/appointment-types/${row.original.id}`}>
          {row.original.name}
        </Link>
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

// A pool can be attached to more than one slot of the same appointment type; the column
// names each pool once rather than repeating it per slot.
function distinctPoolNames(appointmentType: AppointmentType): string[] {
  return [
    ...new Set(
      appointmentType.slots.flatMap((slot) => slot.pools.map((p) => p.name))
    ),
  ];
}

// ---------------------------------------------------------------------------
// appointmentTypeHasOwnedCalendar — true when any slot in the appointment type's roster contains
// a calendar the caller owns. Drives the member-scoped list (Phase 2):
// members see only appointment types they can actually act on, admins see all.
//
// Defense in depth: this filters client-side regardless of whether the
// list endpoint already scopes results to a member's own appointment types server
// side (Open Question 1 in the plan) — so the visible list is never wider
// than "appointment types containing something this viewer owns", independent of
// what the backend returns.
// ---------------------------------------------------------------------------

function appointmentTypeHasOwnedCalendar(
  appointmentType: AppointmentType,
  ownedCalendarIds: ReadonlySet<number>
): boolean {
  return appointmentType.slots.some((slot) =>
    slot.calendars.some((calendar) => ownedCalendarIds.has(calendar.id))
  );
}

/** Every calendar id anywhere in an appointment type's slot roster. */
function appointmentTypeCalendarIds(
  appointmentType: AppointmentType
): number[] {
  return appointmentType.slots.flatMap((slot) =>
    slot.calendars.map((c) => c.id)
  );
}

// ---------------------------------------------------------------------------
// RowActions — the per-row action cell.
//
// Two independent affordances, each gated by its own rule: "Get link" for a
// viewer the owner-or-org-admin predicate allows (a UI affordance only — the
// server re-checks the real rule at mint time regardless, see
// can-mint-booking-link.ts), and "Edit" for an org admin, matching the API
// where every appointment-type-shape write (slots, rosters, pool attachments) is
// admin-only.
//
// Renders null rather than an empty container when a viewer gets neither, so a
// denied row has no stray action cell.
//
// Deliberately stateless: the columns array is rebuilt on every render, which
// remounts these cells — anything stateful belongs in AppointmentTypesTableInner.
// ---------------------------------------------------------------------------

interface RowActionsProps {
  appointmentType: AppointmentType;
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
  onMint: (appointmentType: AppointmentType) => void;
  onEdit: (appointmentType: AppointmentType) => void;
}

function RowActions({
  appointmentType,
  permissions,
  ownedCalendarIds,
  onMint,
  onEdit,
}: RowActionsProps) {
  const canMint = canMintBookingLinkForAppointmentType({
    permissions,
    ownedCalendarIds,
    appointmentTypeCalendarIds: appointmentTypeCalendarIds(appointmentType),
  });
  const canEdit = permissions?.includes(PERMISSIONS.manageMembers) ?? false;

  if (!canMint && !canEdit) return null;

  return (
    <HStack gap={2}>
      {canMint ? (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onMint(appointmentType)}
          aria-label={`Get scheduling link for ${appointmentType.name}`}
        >
          <Link2 aria-hidden />
          Get link
        </Button>
      ) : null}
      {canEdit ? (
        <Button
          size='sm'
          variant='outline'
          onClick={() => onEdit(appointmentType)}
          aria-label={`Edit appointment type ${appointmentType.name}`}
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
// appointment-types-table.test.tsx).
// ---------------------------------------------------------------------------

export function createColumns(
  permissions: readonly string[] | null,
  ownedCalendarIds: ReadonlySet<number>,
  onMint: (appointmentType: AppointmentType) => void,
  onEdit: (appointmentType: AppointmentType) => void
): DataTableColumn<AppointmentType>[] {
  return [
    ...COLUMNS,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          appointmentType={row.original}
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
// AppointmentTypesTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function AppointmentTypesTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No appointment types found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// AppointmentTypesTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

function AppointmentTypesTableInner() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [mintTarget, setMintTarget] = React.useState<AppointmentType | null>(
    null
  );
  const [editing, setEditing] = React.useState<AppointmentType | null>(null);
  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  // Admins see every appointment type in the organization, unchanged from before this
  // phase. Everyone else — members, and the null (not-yet-resolved) permission
  // set — sees only appointment types containing a calendar they own, and gets neither the
  // create action nor the create dialog, since creating an appointment type is an admin
  // roster task this page never offers a member a control for (Non-goals,
  // plan §1: editing appointment types/slots/rosters). Gating on `isAdmin` (rather than
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
  // page their one owned appointment type happens to land on, in an org with more
  // appointment types than one page (BLOCKER 2, phase 2 review). It is the org's total
  // appointment type count that drives that risk, not the member's.
  const nonAdminQuery: DataTableQuery = {
    page: 1,
    pageSize: OWNED_CALENDARS_PAGE_SIZE,
    ordering: query.ordering,
    search: query.search,
  };

  const {
    appointmentTypes: fetchedAppointmentTypes,
    totalCount: fetchedTotalCount,
    isLoading: isAppointmentTypesLoading,
    isError,
    error,
  } = useAppointmentTypes({ query: isAdmin ? query : nonAdminQuery });

  const filteredAppointmentTypes = isAdmin
    ? fetchedAppointmentTypes
    : fetchedAppointmentTypes.filter((appointmentType) =>
        appointmentTypeHasOwnedCalendar(appointmentType, ownedCalendarIds)
      );

  // For a member, totalCount is the TRUE filtered count — the fetch above
  // already pulled every appointment type the org has (up to the large-page limit) in
  // one request, so the filter isn't operating on a single server page.
  const totalCount = isAdmin
    ? fetchedTotalCount
    : filteredAppointmentTypes.length;

  // Client-side pagination of the filtered rows, driven by the URL's
  // page/pageSize — DataTable itself never paginates client-side, so this
  // slice has to happen here for the non-admin branch.
  const appointmentTypes = isAdmin
    ? filteredAppointmentTypes
    : filteredAppointmentTypes.slice(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize
      );

  // A null (not yet resolved) permission set must never render admin chrome or
  // fetched-but-unfiltered data — hold the table in its loading state until
  // we know which branch applies.
  const isLoading =
    permissions === null ||
    isAppointmentTypesLoading ||
    (!isAdmin && isOwnedCalendarsLoading);

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load appointment types.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {getApiErrorMessage(error, 'An unexpected error occurred.')}
        </Text>
      </VStack>
    );
  }

  // A member whose ownership check failed must not silently degrade into
  // "No appointment types found." — that's indistinguishable from genuinely
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
      data-testid='new-appointment-type-button'
    >
      <Plus />
      New appointmentType
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
      <DataTable<AppointmentType>
        data={appointmentTypes}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<AppointmentTypesTableEmpty />}
        showSearch={true}
        toolbarActions={toolbarActions}
      />
      {isAdmin && (
        <>
          <CreateAppointmentTypeDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
          <EditAppointmentTypeDialog
            open={editing !== null}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            appointmentType={editing}
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
            kind: 'appointmentType',
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
// AppointmentTypesTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// AppointmentTypesTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export function AppointmentTypesTable() {
  return <AppointmentTypesTableInner />;
}
