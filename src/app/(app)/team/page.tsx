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
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the table to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

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
