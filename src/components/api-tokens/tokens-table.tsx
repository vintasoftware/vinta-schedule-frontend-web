'use client';

import * as React from 'react';
import { Trash2, RotateCw } from 'lucide-react';
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
import { Flex, VStack, Text } from 'vinta-schedule-design-system/layout';
import { usePublicApiTokens } from '@/hooks/api-tokens/use-public-api-tokens';
import type { SystemUserToken } from '@/hooks/api-tokens/use-public-api-tokens';
import { useRevokePublicApiToken } from '@/hooks/api-tokens/use-revoke-public-api-token';

// ---------------------------------------------------------------------------
// Column definitions
// Helper to create columns — accepts pendingRowIds (to disable actions for
// in-flight rows) and onRevoke (row action handler). This allows the table to
// pass its local pending-row state down into the column cell renderer.
// SECURITY: NO secret/token column — list endpoint returns metadata only.
// ---------------------------------------------------------------------------

function createColumns(
  pendingRowIds: Set<number>,
  onRevoke: (token: SystemUserToken) => Promise<void>
): DataTableColumn<SystemUserToken>[] {
  return [
    {
      accessorKey: 'integration_name',
      id: 'integration_name',
      header: 'Name',
      enableSorting: false,
      cell: ({ row }) => (
        <Text weight='medium'>{row.original.integration_name}</Text>
      ),
    },
    {
      accessorKey: 'available_resources',
      id: 'available_resources',
      header: 'Scopes',
      enableSorting: false,
      cell: ({ row }) => (
        <Flex wrap gap={1}>
          {row.original.available_resources.length === 0 ? (
            <Text color='muted-foreground' size='sm'>
              —
            </Text>
          ) : (
            row.original.available_resources.map((r) => (
              <Badge key={r} variant='secondary' className='text-xs'>
                {r}
              </Badge>
            ))
          )}
        </Flex>
      ),
    },
    {
      accessorKey: 'is_active',
      id: 'is_active',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) =>
        row.original.is_active ? (
          <Badge variant='success'>Active</Badge>
        ) : (
          <Badge variant='secondary'>Inactive</Badge>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RevokeButton
          token={row.original}
          isLoading={pendingRowIds.has(row.original.id)}
          onRevoke={onRevoke}
        />
      ),
    },
  ];
}

// Legacy export for backward compatibility (stories/tests that build columns statically).
export const COLUMNS = createColumns(new Set(), async () => {});

// ---------------------------------------------------------------------------
// RevokeButton — per-row action to revoke a token with confirmation
// ---------------------------------------------------------------------------

interface RevokeButtonProps {
  token: SystemUserToken;
  isLoading: boolean;
  onRevoke: (token: SystemUserToken) => Promise<void>;
}

function RevokeButton({ token, isLoading, onRevoke }: RevokeButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleConfirm = React.useCallback(async () => {
    await onRevoke(token);
    setDialogOpen(false);
  }, [token, onRevoke]);

  return (
    <>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setDialogOpen(true)}
        disabled={isLoading || !token.is_active}
        aria-label={`Revoke token ${token.integration_name}`}
      >
        {isLoading ? (
          <>
            <RotateCw className='mr-1 size-4 animate-spin' aria-hidden />
            Revoking…
          </>
        ) : (
          <>
            <Trash2 className='mr-1 size-4' aria-hidden />
            Revoke
          </>
        )}
      </Button>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke token</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke{' '}
              <span className='font-medium'>{token.integration_name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
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
// TokensTableEmpty — custom empty state
// ---------------------------------------------------------------------------

function TokensTableEmpty() {
  return (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No API tokens found.
      </Text>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// TokensTableInner — renders inside the DataTableQueryBoundary.
// ---------------------------------------------------------------------------

interface TokensTableInnerProps {
  toolbarActions?: React.ReactNode;
}

function TokensTableInner({ toolbarActions }: TokensTableInnerProps) {
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

  const { tokens, totalCount, isLoading, isError, error } = usePublicApiTokens({
    query,
  });

  const { revokeToken } = useRevokePublicApiToken();

  // Handle revoke action: track in-flight row, call hook, show toast.
  // The row is updated by invalidation after the mutation succeeds.
  const handleRevoke = React.useCallback(
    async (token: SystemUserToken) => {
      // Mark this row as pending to disable its button.
      setPendingRowIds((prev) => new Set(prev).add(token.id));

      try {
        await revokeToken(String(token.id));
        toast.success('Token revoked', {
          description: `${token.integration_name} has been revoked.`,
        });
      } catch (err) {
        toast.error('Failed to revoke token', {
          description:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred.',
        });
      } finally {
        // Always clear the pending state, even on error.
        // Note: on success, the row is updated by invalidation, so this cleanup
        // is mainly for error cases.
        setPendingRowIds((prev) => {
          const next = new Set(prev);
          next.delete(token.id);
          return next;
        });
      }
    },
    [revokeToken]
  );

  if (isError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load API tokens.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  const columns = createColumns(pendingRowIds, handleRevoke);

  return (
    <DataTable<SystemUserToken>
      data={tokens}
      columns={columns}
      query={query}
      onQueryChange={handleQueryChange}
      totalCount={totalCount}
      isLoading={isLoading}
      emptyState={<TokensTableEmpty />}
      showSearch={false}
      toolbarActions={toolbarActions}
    />
  );
}

// ---------------------------------------------------------------------------
// TokensTable — exported composition.
//
// Must be rendered inside a DataTableQueryBoundary (the page does this) because
// TokensTableInner calls useDataTableQuery which calls useSearchParams.
// ---------------------------------------------------------------------------

export interface TokensTableProps {
  /** Extra toolbar content (e.g. "New token" button). */
  toolbarActions?: React.ReactNode;
}

export function TokensTable({ toolbarActions }: TokensTableProps) {
  return <TokensTableInner toolbarActions={toolbarActions} />;
}
