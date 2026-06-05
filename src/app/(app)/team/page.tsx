'use client';

import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { TeamTable } from '@/components/team/team-table';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * TeamPage — admin-only view of all org members.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 */
export default function TeamPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so the
  // page still renders briefly; components should render nothing sensitive until
  // isAllowed is true.
  useRequireRole('admin');

  return (
    <Stack gap={6}>
      <PageHeader
        title='Team'
        description='Manage your organization members.'
      />
      <DataTableQueryBoundary>
        <TeamTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
