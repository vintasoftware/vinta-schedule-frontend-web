'use client';

/**
 * BookingPoliciesTable — paginated list of the org's booking policies with edit
 * and delete row actions.
 *
 * Each row shows the resolved target (calendar / group / member name, or
 * "Organization default"), the target kind, and the four guardrail values
 * formatted for humans. Deletes go through an AlertDialog confirmation; the
 * backend destroy is idempotent so a stale row deletes cleanly.
 *
 * Must be rendered inside a DataTableQueryBoundary (the page provides it)
 * because it calls useDataTableQuery → useSearchParams.
 */

import * as React from 'react';
import { Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
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
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useBookingPolicies,
  useDeleteBookingPolicy,
  type BookingPolicy,
} from '@/hooks/booking-policies/use-booking-policies';
import { BookingPolicyDialog } from './booking-policy-dialog';
import { formatDurationShort } from './duration';
import { getTargetEntityId, getTargetType, targetTypeLabel } from './target';
import { useTargetOptions } from './use-target-options';

type ResolveTargetLabel = ReturnType<
  typeof useTargetOptions
>['resolveTargetLabel'];

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function createColumns(
  pendingRowIds: Set<number>,
  resolveTargetLabel: ResolveTargetLabel,
  onEdit: (policy: BookingPolicy) => void,
  onDelete: (policy: BookingPolicy) => Promise<void>
): DataTableColumn<BookingPolicy>[] {
  return [
    {
      id: 'target',
      header: 'Applies to',
      enableSorting: false,
      cell: ({ row }) => {
        const type = getTargetType(row.original);
        const label =
          type === 'organization_default'
            ? 'Organization default'
            : resolveTargetLabel(type, getTargetEntityId(row.original));
        return (
          <VStack gap={0}>
            <Text weight='medium'>{label}</Text>
            <Text size='sm' color='muted-foreground'>
              {targetTypeLabel(type)}
            </Text>
          </VStack>
        );
      },
    },
    {
      id: 'lead_time',
      header: 'Lead time',
      enableSorting: false,
      cell: ({ row }) => (
        <Text>{formatDurationShort(row.original.lead_time_seconds ?? 0)}</Text>
      ),
    },
    {
      id: 'max_horizon',
      header: 'Horizon',
      enableSorting: false,
      cell: ({ row }) => (
        <Text>
          {formatDurationShort(row.original.max_horizon_seconds ?? 0)}
        </Text>
      ),
    },
    {
      id: 'buffers',
      header: 'Buffers (before / after)',
      enableSorting: false,
      cell: ({ row }) => (
        <Text>
          {formatDurationShort(row.original.buffer_before_seconds ?? 0)}
          {' / '}
          {formatDurationShort(row.original.buffer_after_seconds ?? 0)}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          policy={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          targetLabel={
            getTargetType(row.original) === 'organization_default'
              ? 'Organization default'
              : resolveTargetLabel(
                  getTargetType(row.original),
                  getTargetEntityId(row.original)
                )
          }
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// RowActions
// ---------------------------------------------------------------------------

interface RowActionsProps {
  policy: BookingPolicy;
  isLoading: boolean;
  targetLabel: string;
  onEdit: (policy: BookingPolicy) => void;
  onDelete: (policy: BookingPolicy) => Promise<void>;
}

function RowActions({
  policy,
  isLoading,
  targetLabel,
  onEdit,
  onDelete,
}: RowActionsProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onDelete(policy);
    setDialogOpen(false);
  }, [policy, onDelete]);

  return (
    <HStack gap={2}>
      <Button
        size='sm'
        variant='outline'
        onClick={() => onEdit(policy)}
        disabled={isLoading}
        aria-label={`Edit policy for ${targetLabel}`}
      >
        <Pencil aria-hidden />
        Edit
      </Button>

      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Delete policy for ${targetLabel}`}
      >
        {isLoading ? (
          <>
            <Spinner label='' />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 aria-hidden />
            Delete
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete booking policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking policy for{' '}
              <Text weight='medium'>{targetLabel}</Text>? Slot discovery and
              booking will fall through to the next resolution layer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              variant='destructive'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function BookingPoliciesTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No booking policies yet. Slots are offered without guardrails until you
        add one.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Inner
// ---------------------------------------------------------------------------

interface BookingPoliciesTableInnerProps {
  toolbarActions?: React.ReactNode;
}

function BookingPoliciesTableInner({
  toolbarActions,
}: BookingPoliciesTableInnerProps) {
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const [editing, setEditing] = React.useState<BookingPolicy | null>(null);
  const { query, setPage } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
    },
    [query, setPage]
  );

  const { policies, totalCount, isLoading, isError, error } =
    useBookingPolicies({ query });
  const { resolveTargetLabel } = useTargetOptions();
  const { deleteBookingPolicy } = useDeleteBookingPolicy();

  const handleDelete = React.useCallback(
    async (policy: BookingPolicy) => {
      setPendingRowIds((prev) => new Set(prev).add(policy.id));
      try {
        await deleteBookingPolicy(policy.id);
        toast.success('Booking policy deleted');
      } catch (err) {
        toast.error('Failed to delete booking policy', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(policy.id);
          return nextSet;
        });
      }
    },
    [deleteBookingPolicy]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load booking policies.
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
    resolveTargetLabel,
    setEditing,
    handleDelete
  );

  return (
    <>
      <DataTable<BookingPolicy>
        data={policies}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<BookingPoliciesTableEmpty />}
        showSearch={false}
        toolbarActions={toolbarActions}
      />
      <BookingPolicyDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        policy={editing}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Exported composition
// ---------------------------------------------------------------------------

export interface BookingPoliciesTableProps {
  /** Extra toolbar content (e.g. "New policy" button). */
  toolbarActions?: React.ReactNode;
}

export function BookingPoliciesTable({
  toolbarActions,
}: BookingPoliciesTableProps) {
  return <BookingPoliciesTableInner toolbarActions={toolbarActions} />;
}
