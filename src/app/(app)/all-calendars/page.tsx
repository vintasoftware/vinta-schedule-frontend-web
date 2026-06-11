'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { AllCalendarsTable } from '@/components/calendars/all-calendars-table';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * AllCalendarsPage — admin-only view of all org calendars.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders a paginated datatable of all calendars (personal, resource, virtual, bundle)
 * with type, provider, and status badges.
 */
export default function AllCalendarsPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the table to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='All calendars'
        description='View all organization calendars including personal, resource, virtual, and bundle calendars.'
      />
      <DataTableQueryBoundary>
        <AllCalendarsTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
