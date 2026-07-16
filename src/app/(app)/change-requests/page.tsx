'use client';

import { Stack, PageHeader } from 'vinta-schedule-design-system/layout';
import { DataTableQueryBoundary } from '@/components/data-table/use-data-table-query';
import { ChangeRequestsTable } from '@/components/change-requests/change-requests-table';

/**
 * ChangeRequestsPage — review and resolve external-event change requests.
 *
 * Visible to both admins and members: eligibility is scoped server-side
 * (admins see every request in the org; members see only requests against
 * events they attend), so this route is not role-gated.
 *
 * Shows a paginated, status-filtered table of change requests. Pending rows
 * can be approved (apply the proposed change locally) or rejected (push the
 * retained value back to the provider); every row can be opened for a
 * before/after detail view.
 */
export default function ChangeRequestsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Change requests'
        description='Review changes proposed by your calendar providers and approve or reject them.'
      />
      <DataTableQueryBoundary>
        <ChangeRequestsTable />
      </DataTableQueryBoundary>
    </Stack>
  );
}
