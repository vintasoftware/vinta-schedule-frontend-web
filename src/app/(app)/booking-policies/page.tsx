'use client';

import * as React from 'react';
import { Stack, PageHeader } from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { Plus } from 'lucide-react';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { BookingPoliciesTable } from '@/components/booking-policies/booking-policies-table';
import { BookingPolicyDialog } from '@/components/booking-policies/booking-policy-dialog';
import { useRequireRole } from '@/components/navigation/role-gate';

/**
 * BookingPoliciesPage — admin-only view for managing booking policies.
 *
 * Guarded by useRequireRole('admin'): a member who reaches this URL is
 * redirected to '/'.
 *
 * Shows a paginated table of the org's booking policies (targeting calendars,
 * calendar groups, members, or the org default) with a "New policy" button that
 * opens the BookingPolicyDialog for creation. Each row has edit and delete
 * actions.
 */
export default function BookingPoliciesPage() {
  const { isAllowed } = useRequireRole('admin');
  const [newPolicyDialogOpen, setNewPolicyDialogOpen] = React.useState(false);

  if (!isAllowed) return null;

  const toolbarActions = (
    <Button
      size='sm'
      onClick={() => setNewPolicyDialogOpen(true)}
      data-testid='new-booking-policy-button'
    >
      <Plus />
      New policy
    </Button>
  );

  return (
    <Stack gap={6}>
      <PageHeader
        title='Booking policies'
        description='Add lead time, booking horizon, and buffer guardrails to slot discovery and booking. Policies apply to a calendar, a calendar group, a member, or the whole organization.'
      />
      <DataTableQueryBoundary>
        <BookingPoliciesTable toolbarActions={toolbarActions} />
      </DataTableQueryBoundary>
      <BookingPolicyDialog
        open={newPolicyDialogOpen}
        onOpenChange={setNewPolicyDialogOpen}
      />
    </Stack>
  );
}
