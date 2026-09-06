'use client';

import * as React from 'react';
import { Stack, PageHeader } from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Plus } from 'lucide-react';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { PoolsTable } from '@/components/calendar-pools/pools-table';
import { PoolDialog } from '@/components/calendar-pools/pool-dialog';
import {
  useRequirePermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';

/**
 * PoolsPage — admin view for managing calendar pools.
 *
 * Guarded by useRequirePermission(PERMISSIONS.manageMembers), matching the
 * API's own rule: every pool write is admin-only. A non-admin member can read
 * the pools they participate in through the API, but has no action to take on
 * this page, so they are redirected rather than shown a read-only table.
 */
export default function PoolsPage() {
  const { isAllowed } = useRequirePermission(PERMISSIONS.manageMembers);
  const [newPoolDialogOpen, setNewPoolDialogOpen] = React.useState(false);

  if (!isAllowed) return null;

  const toolbarActions = (
    <Button
      size='sm'
      onClick={() => setNewPoolDialogOpen(true)}
      data-testid='new-pool-button'
    >
      <Plus />
      New pool
    </Button>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title='Calendar pools'
        description='Reusable rosters of calendars. Attach a pool to the slots of any appointment type, and one roster edit reaches every appointment type using it.'
      />
      <DataTableQueryBoundary>
        <PoolsTable toolbarActions={toolbarActions} />
      </DataTableQueryBoundary>
      <PoolDialog
        open={newPoolDialogOpen}
        onOpenChange={setNewPoolDialogOpen}
      />
    </Stack>
  );
}
