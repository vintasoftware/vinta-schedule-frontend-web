'use client';

import * as React from 'react';
import { Stack } from '@vinta-schedule/design-system/layout/stack';
import { PageHeader } from '@vinta-schedule/design-system/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { GroupsTable } from '@/components/calendar-groups/groups-table';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * GroupsPage — admin-only view of all org calendar groups.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders a paginated, searchable datatable of calendar groups with columns:
 * - Name
 * - Description
 * - Slot count
 */
export default function GroupsPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the table to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Calendar groups'
        description='Manage your organization calendar groups.'
      />
      <DataTableQueryBoundary>
        <GroupsTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
