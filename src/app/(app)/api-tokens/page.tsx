'use client';

import * as React from 'react';
import { Stack, PageHeader } from '@vinta-schedule/design-system/layout';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Plus } from 'lucide-react';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { TokensTable } from '@/components/api-tokens/tokens-table';
import { NewTokenDialog } from '@/components/api-tokens/new-token-dialog';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * ApiTokensPage — admin-only view for managing public API tokens.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL
 * is redirected to '/' (degrade-don't-loop rule).
 *
 * Shows a paginated table of token metadata (name, scopes, status) with a
 * "New token" button that opens the NewTokenDialog for token creation.
 *
 * The table renders NO secret column — the list API returns only metadata.
 */
export default function ApiTokensPage() {
  const { isAllowed } = useRequireRole('admin');
  const [newTokenDialogOpen, setNewTokenDialogOpen] = React.useState(false);

  if (!isAllowed) return null;

  const toolbarActions = (
    <Button
      size='sm'
      onClick={() => setNewTokenDialogOpen(true)}
      data-testid='new-token-button'
    >
      <Plus className='mr-1 h-4 w-4' />
      New token
    </Button>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title='API tokens'
        description='Manage your organization API tokens for integrations.'
      />
      <DataTableQueryBoundary>
        <TokensTable toolbarActions={toolbarActions} />
      </DataTableQueryBoundary>
      <NewTokenDialog
        open={newTokenDialogOpen}
        onOpenChange={setNewTokenDialogOpen}
      />
    </Stack>
  );
}
