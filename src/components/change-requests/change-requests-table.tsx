'use client';

import * as React from 'react';
import { Check, X, RotateCw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table/data-table';
import { useDataTableQuery } from '@/components/data-table/use-data-table-query';
import type { DataTableColumn } from '@/components/data-table/types';
import { Badge } from 'vinta-schedule-design-system/ui/badge';
import { Button } from 'vinta-schedule-design-system/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from 'vinta-schedule-design-system/ui/select';
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
import { formatDateTime } from '@/lib/utils/date-utils';
import {
  useChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
  type ExternalEventChangeRequest,
  type ExternalEventChangeRequestStatusEnum,
} from '@/hooks/change-requests/use-change-requests';
import { ChangeRequestDetailDialog } from './change-request-detail-dialog';
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
  STATUS_FILTER_OPTIONS,
  KIND_LABELS,
  PROVIDER_LABELS,
} from './change-request-metadata';

const DEFAULT_STATUS: ExternalEventChangeRequestStatusEnum = 'pending';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export function createColumns(
  pendingRowIds: Set<number>,
  onView: (changeRequest: ExternalEventChangeRequest) => void,
  onApprove: (changeRequest: ExternalEventChangeRequest) => Promise<void>,
  onReject: (changeRequest: ExternalEventChangeRequest) => Promise<void>
): DataTableColumn<ExternalEventChangeRequest>[] {
  return [
    {
      accessorKey: 'kind',
      id: 'kind',
      header: 'Change',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant='outline'>{KIND_LABELS[row.original.kind]}</Badge>
      ),
    },
    {
      accessorKey: 'event_id',
      id: 'event_id',
      header: 'Event',
      enableSorting: false,
      cell: ({ row }) => (
        <Text className='font-mono text-sm'>#{row.original.event_id}</Text>
      ),
    },
    {
      accessorKey: 'provider',
      id: 'provider',
      header: 'Provider',
      enableSorting: false,
      cell: ({ row }) => (
        <Text size='sm'>
          {PROVIDER_LABELS[row.original.provider] ?? row.original.provider}
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>
          {STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'created',
      id: 'created',
      header: 'Requested',
      enableSorting: false,
      cell: ({ row }) => (
        <Text size='sm' color='muted-foreground'>
          {formatDateTime(row.original.created) ?? '—'}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          changeRequest={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onView={onView}
          onApprove={onApprove}
          onReject={onReject}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// RowActions — view (always) + approve / reject (pending only, with confirm).
// ---------------------------------------------------------------------------

type ResolveAction = 'approve' | 'reject';

interface RowActionsProps {
  changeRequest: ExternalEventChangeRequest;
  isLoading: boolean;
  onView: (changeRequest: ExternalEventChangeRequest) => void;
  onApprove: (changeRequest: ExternalEventChangeRequest) => Promise<void>;
  onReject: (changeRequest: ExternalEventChangeRequest) => Promise<void>;
}

function RowActions({
  changeRequest,
  isLoading,
  onView,
  onApprove,
  onReject,
}: RowActionsProps) {
  const [confirming, setConfirming] = React.useState<ResolveAction | null>(
    null
  );
  const isPendingStatus = changeRequest.status === 'pending';

  const handleConfirm = React.useCallback(async () => {
    if (confirming === 'approve') await onApprove(changeRequest);
    else if (confirming === 'reject') await onReject(changeRequest);
    setConfirming(null);
  }, [confirming, changeRequest, onApprove, onReject]);

  return (
    <HStack gap={2}>
      <Button
        size='sm'
        variant='ghost'
        onClick={() => onView(changeRequest)}
        aria-label={`View change request ${changeRequest.id}`}
      >
        <Eye className='mr-1 size-4' aria-hidden />
        View
      </Button>

      {isPendingStatus && (
        <>
          <Button
            size='sm'
            variant='outline'
            onClick={() => setConfirming('approve')}
            disabled={isLoading}
            aria-label={`Approve change request ${changeRequest.id}`}
          >
            {isLoading ? (
              <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            ) : (
              <Check className='mr-1 size-4' aria-hidden />
            )}
            Approve
          </Button>

          <Button
            size='sm'
            variant='outline'
            onClick={() => setConfirming('reject')}
            disabled={isLoading}
            aria-label={`Reject change request ${changeRequest.id}`}
          >
            <X className='mr-1 size-4' aria-hidden />
            Reject
          </Button>
        </>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === 'approve'
                ? 'Approve change request'
                : 'Reject change request'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === 'approve'
                ? 'The proposed change will be applied to the local event. This cannot be undone.'
                : 'The current values will be pushed back to the provider, overwriting the proposed change. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {confirming === 'approve' ? 'Approve' : 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// StatusFilter — Select driving the status query param.
// ---------------------------------------------------------------------------

interface StatusFilterProps {
  value: ExternalEventChangeRequestStatusEnum;
  onChange: (value: ExternalEventChangeRequestStatusEnum) => void;
}

function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) =>
        onChange(next as ExternalEventChangeRequestStatusEnum)
      }
    >
      <SelectTrigger
        className='w-40'
        aria-label='Filter by status'
        data-testid='status-filter'
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTER_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function ChangeRequestsTableEmpty({
  status,
}: {
  status: ExternalEventChangeRequestStatusEnum;
}) {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No {STATUS_LABELS[status].toLowerCase()} change requests.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Inner table
// ---------------------------------------------------------------------------

function ChangeRequestsTableInner() {
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const [status, setStatus] =
    React.useState<ExternalEventChangeRequestStatusEnum>(DEFAULT_STATUS);
  const [viewing, setViewing] =
    React.useState<ExternalEventChangeRequest | null>(null);

  const { query, setPage, setSearch, setOrdering } = useDataTableQuery();

  const handleQueryChange = React.useCallback(
    (next: typeof query) => {
      if (next.page !== query.page) setPage(next.page);
      if (next.search !== query.search) setSearch(next.search);
      if (next.ordering !== query.ordering) setOrdering(next.ordering);
    },
    [query, setPage, setSearch, setOrdering]
  );

  const handleStatusChange = React.useCallback(
    (next: ExternalEventChangeRequestStatusEnum) => {
      setStatus(next);
      setPage(1);
    },
    [setPage]
  );

  const { changeRequests, totalCount, isLoading, isError, error } =
    useChangeRequests({ query, status });

  const { approveChangeRequest } = useApproveChangeRequest();
  const { rejectChangeRequest } = useRejectChangeRequest();

  const withPending = React.useCallback(
    async (id: number, fn: () => Promise<unknown>) => {
      setPendingRowIds((prev) => new Set(prev).add(id));
      try {
        await fn();
      } finally {
        setPendingRowIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(id);
          return nextSet;
        });
      }
    },
    []
  );

  const handleApprove = React.useCallback(
    async (changeRequest: ExternalEventChangeRequest) => {
      await withPending(changeRequest.id, async () => {
        try {
          await approveChangeRequest(changeRequest.id);
          toast.success('Change request approved');
        } catch (err) {
          toast.error('Failed to approve change request', {
            description:
              err instanceof Error
                ? err.message
                : 'It may no longer be pending. Refresh and try again.',
          });
        }
      });
    },
    [withPending, approveChangeRequest]
  );

  const handleReject = React.useCallback(
    async (changeRequest: ExternalEventChangeRequest) => {
      await withPending(changeRequest.id, async () => {
        try {
          await rejectChangeRequest(changeRequest.id);
          toast.success('Change request rejected');
        } catch (err) {
          toast.error('Failed to reject change request', {
            description:
              err instanceof Error
                ? err.message
                : 'It may no longer be pending. Refresh and try again.',
          });
        }
      });
    },
    [withPending, rejectChangeRequest]
  );

  const toolbarActions = (
    <StatusFilter value={status} onChange={handleStatusChange} />
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load change requests.
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
    setViewing,
    handleApprove,
    handleReject
  );

  return (
    <>
      <DataTable<ExternalEventChangeRequest>
        data={changeRequests}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<ChangeRequestsTableEmpty status={status} />}
        showSearch={false}
        toolbarActions={toolbarActions}
      />
      <ChangeRequestDetailDialog
        changeRequest={viewing}
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// ChangeRequestsTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// the inner component calls useDataTableQuery → useSearchParams.
// ---------------------------------------------------------------------------

export function ChangeRequestsTable() {
  return <ChangeRequestsTableInner />;
}
