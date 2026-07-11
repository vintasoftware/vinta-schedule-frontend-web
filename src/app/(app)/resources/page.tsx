'use client';

import * as React from 'react';
import { Plus } from 'lucide-react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { AllCalendarsTable } from '@/components/calendars/all-calendars-table';
import { CreateResourceCalendarDialog } from '@/components/calendars/create-resource-calendar-dialog';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * ResourcesPage — admin-only view of the organization's resource calendars
 * (rooms, equipment, and other shared bookable resources).
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders a paginated datatable scoped to resource calendars and a button that
 * opens the create-resource-calendar dialog.
 */
export default function ResourcesPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the table to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');
  const [createOpen, setCreateOpen] = React.useState(false);

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Resources'
        description='Manage shared resource calendars — rooms, equipment, and anything members can book.'
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className='mr-1 size-4' aria-hidden />
            New resource calendar
          </Button>
        }
      />
      <DataTableQueryBoundary>
        <AllCalendarsTable calendarType='resource' />
      </DataTableQueryBoundary>

      <CreateResourceCalendarDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </Stack>
  );
}
