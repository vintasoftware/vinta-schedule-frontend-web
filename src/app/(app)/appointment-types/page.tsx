'use client';

import * as React from 'react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { AppointmentTypesTable } from '@/components/appointment-types/appointment-types-table';
import {
  useHasPermission,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';

/**
 * AppointmentTypesPage — the appointment types list.
 *
 * Phase 1 admin-gated this route with useRequireRole('admin'). Phase 2
 * opens it to members too: an admin still sees every appointment type in the
 * organization, but a member sees only the appointment types containing a calendar
 * they own (filtered inside AppointmentTypesTable, which is where the ownership
 * check and the fetched data live) — the entry point for UC-2/UC-3, a
 * member configuring their own participation. This is the one phase in the
 * plan that touches an existing surface; it ships alone precisely so a
 * revert restores the admin-only gate cleanly.
 */
export default function AppointmentTypesPage() {
  const isAdmin = useHasPermission(PERMISSIONS.manageMembers);

  return (
    <Stack gap={6}>
      <PageHeader
        title='Appointment types'
        description={
          isAdmin
            ? 'Manage your organization appointment types.'
            : 'Appointment types you belong to.'
        }
      />
      <DataTableQueryBoundary>
        <AppointmentTypesTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
