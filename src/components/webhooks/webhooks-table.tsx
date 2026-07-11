'use client';

import * as React from 'react';
import { Trash2, RotateCw, Pencil } from 'lucide-react';
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
import { HStack, VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  useWebhookConfigurations,
  useDeleteWebhookConfiguration,
  type WebhookConfiguration,
} from '@/hooks/webhooks/use-webhook-configurations';
import { WebhookDialog } from './webhook-dialog';
import { eventTypeLabel } from './event-types';

// ---------------------------------------------------------------------------
// Column definitions — accepts pendingRowIds (to disable in-flight rows) and
// the edit / delete row-action handlers.
// ---------------------------------------------------------------------------

function createColumns(
  pendingRowIds: Set<number>,
  onEdit: (configuration: WebhookConfiguration) => void,
  onDelete: (configuration: WebhookConfiguration) => Promise<void>
): DataTableColumn<WebhookConfiguration>[] {
  return [
    {
      accessorKey: 'event_type',
      id: 'event_type',
      header: 'Event',
      enableSorting: false,
      cell: ({ row }) => (
        <Badge variant='secondary'>
          {eventTypeLabel(row.original.event_type)}
        </Badge>
      ),
    },
    {
      accessorKey: 'url',
      id: 'url',
      header: 'Payload URL',
      enableSorting: false,
      cell: ({ row }) => (
        <Text className='font-mono text-sm break-all'>{row.original.url}</Text>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          configuration={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// RowActions — edit + delete (with confirmation) for a single row.
// ---------------------------------------------------------------------------

interface RowActionsProps {
  configuration: WebhookConfiguration;
  isLoading: boolean;
  onEdit: (configuration: WebhookConfiguration) => void;
  onDelete: (configuration: WebhookConfiguration) => Promise<void>;
}

function RowActions({
  configuration,
  isLoading,
  onEdit,
  onDelete,
}: RowActionsProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onDelete(configuration);
    setDialogOpen(false);
  }, [configuration, onDelete]);

  return (
    <HStack gap={2}>
      <Button
        size='sm'
        variant='outline'
        onClick={() => onEdit(configuration)}
        disabled={isLoading}
        aria-label={`Edit webhook ${configuration.url}`}
      >
        <Pencil className='mr-1 size-4' aria-hidden />
        Edit
      </Button>

      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading}
        aria-label={`Delete webhook ${configuration.url}`}
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Deleting…
          </>
        ) : (
          <>
            <Trash2 className='mr-1 size-4' aria-hidden />
            Delete
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the webhook for{' '}
              <span className='font-medium'>
                {eventTypeLabel(configuration.event_type)}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
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
// WebhooksTableEmpty — custom empty state.
// ---------------------------------------------------------------------------

function WebhooksTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No webhooks configured yet.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// WebhooksTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

interface WebhooksTableInnerProps {
  toolbarActions?: React.ReactNode;
}

function WebhooksTableInner({ toolbarActions }: WebhooksTableInnerProps) {
  const [pendingRowIds, setPendingRowIds] = React.useState<Set<number>>(
    new Set()
  );
  const [editing, setEditing] = React.useState<WebhookConfiguration | null>(
    null
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

  const { configurations, totalCount, isLoading, isError, error } =
    useWebhookConfigurations({ query });

  const { deleteWebhookConfiguration } = useDeleteWebhookConfiguration();

  const handleDelete = React.useCallback(
    async (configuration: WebhookConfiguration) => {
      setPendingRowIds((prev) => new Set(prev).add(configuration.id));

      try {
        await deleteWebhookConfiguration(configuration.id);
        toast.success('Webhook deleted');
      } catch (err) {
        toast.error('Failed to delete webhook', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        setPendingRowIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(configuration.id);
          return nextSet;
        });
      }
    },
    [deleteWebhookConfiguration]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load webhooks.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const columns = createColumns(pendingRowIds, setEditing, handleDelete);

  return (
    <>
      <DataTable<WebhookConfiguration>
        data={configurations}
        columns={columns}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={totalCount}
        isLoading={isLoading}
        emptyState={<WebhooksTableEmpty />}
        showSearch={false}
        toolbarActions={toolbarActions}
      />
      <WebhookDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        configuration={editing}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// WebhooksTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// WebhooksTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export interface WebhooksTableProps {
  /** Extra toolbar content (e.g. "New webhook" button). */
  toolbarActions?: React.ReactNode;
}

export function WebhooksTable({ toolbarActions }: WebhooksTableProps) {
  return <WebhooksTableInner toolbarActions={toolbarActions} />;
}
