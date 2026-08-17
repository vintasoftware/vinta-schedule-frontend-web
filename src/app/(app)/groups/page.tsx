'use client';

import * as React from 'react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { GroupsTable } from '@/components/calendar-groups/groups-table';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';

/**
 * GroupsPage — the calendar groups list.
 *
 * Phase 1 admin-gated this route with useRequireRole('admin'). Phase 2
 * opens it to members too: an admin still sees every group in the
 * organization, but a member sees only the groups containing a calendar
 * they own (filtered inside GroupsTable, which is where the ownership
 * check and the fetched data live) — the entry point for UC-2/UC-3, a
 * member configuring their own participation. This is the one phase in the
 * plan that touches an existing surface; it ships alone precisely so a
 * revert restores the admin-only gate cleanly.
 */
export default function GroupsPage() {
  const isAdmin = useHasPermission(PERMISSIONS.manageMembers);

  return (
    <Stack gap={6}>
      <PageHeader
        title='Calendar groups'
        description={
          isAdmin
            ? 'Manage your organization calendar groups.'
            : 'Calendar groups you belong to.'
        }
      />
      <DataTableQueryBoundary>
        <GroupsTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
