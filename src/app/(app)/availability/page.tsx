import { Suspense } from 'react';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import { PageHeader } from 'vinta-schedule-design-system/layout/page-header';
import { AvailabilityTabs } from '@/components/availability/availability-tabs';

/**
 * AvailabilityPage — member route for editing available-time windows and blocked times.
 *
 * No admin gate: any authenticated member can access this route.
 * The backend scopes available-time and blocked-time reads/writes to the calling member.
 *
 * Renders PageHeader + AvailabilityTabs. The tabs (and the My-availability week
 * pager) track their state on the URL, so the interactive parts live in the
 * AvailabilityTabs client component behind a <Suspense> boundary — required
 * because it calls useSearchParams (Next.js 15+).
 */
export default function AvailabilityPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Availability'
        description='Set your weekly available hours, one-off windows, and blocked times.'
      />
      <Suspense fallback={null}>
        <AvailabilityTabs />
      </Suspense>
    </Stack>
  );
}
