'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { AllCalendarsTable } from '@/components/calendars/all-calendars-table';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * PeopleCalendarsPage — admin-only view of the organization's people
 * (personal) calendars.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders a paginated datatable scoped to personal calendars. Resource, virtual,
 * and bundle calendars have their own dedicated surfaces.
 */
export default function PeopleCalendarsPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the table to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='People calendars'
        description="View the organization's personal calendars, one per member."
      />
      <DataTableQueryBoundary>
        <AllCalendarsTable calendarType='personal' />
      </DataTableQueryBoundary>
    </Stack>
  );
}
