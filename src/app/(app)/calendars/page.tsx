'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { CalendarsTable } from '@/components/calendars/calendars-table';

/**
 * CalendarsPage — member view of their own calendars.
 *
 * No admin gate: any authenticated member can see this route and access their
 * own calendars (the backend scopes the list automatically).
 *
 * Renders a paginated datatable of calendars with type, provider, and status.
 */
export default function CalendarsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='My calendars'
        description='View and manage your calendars.'
      />
      <DataTableQueryBoundary>
        <CalendarsTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
