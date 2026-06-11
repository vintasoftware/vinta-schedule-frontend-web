'use client';

import * as React from 'react';
import { Stack, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { WebhooksTable } from '@/components/webhooks/webhooks-table';
import { WebhookDialog } from '@/components/webhooks/webhook-dialog';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * WebhooksPage — admin-only view for managing webhook configurations.
 *
 * Guarded by useRequireRole('admin'): a member who reaches this URL is
 * redirected to '/'.
 *
 * Shows a paginated table of webhook configs (event type, payload URL) with a
 * "New webhook" button that opens the WebhookDialog for creation. Each row has
 * edit and delete actions.
 */
export default function WebhooksPage() {
  const { isAllowed } = useRequireRole('admin');
  const [newWebhookDialogOpen, setNewWebhookDialogOpen] = React.useState(false);

  if (!isAllowed) return null;

  const toolbarActions = (
    <Button
      size='sm'
      onClick={() => setNewWebhookDialogOpen(true)}
      data-testid='new-webhook-button'
    >
      <Plus className='mr-1 h-4 w-4' />
      New webhook
    </Button>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title='Webhooks'
        description='Deliver real-time event notifications to your own endpoints.'
      />
      <DataTableQueryBoundary>
        <WebhooksTable toolbarActions={toolbarActions} />
      </DataTableQueryBoundary>
      <WebhookDialog
        open={newWebhookDialogOpen}
        onOpenChange={setNewWebhookDialogOpen}
      />
    </Stack>
  );
}
