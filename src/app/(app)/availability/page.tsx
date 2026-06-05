'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { AvailabilityEditor } from '@/components/availability/availability-editor';

/**
 * AvailabilityPage — member route for editing available-time windows.
 *
 * No admin gate: any authenticated member can access this route.
 * The backend scopes available-time reads/writes to the calling member.
 *
 * Renders:
 *  - PageHeader "Availability"
 *  - AvailabilityEditor (weekly patterns + ad-hoc dates)
 */
export default function AvailabilityPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Availability'
        description='Set your weekly available hours and one-off date windows.'
      />
      <AvailabilityEditor />
    </Stack>
  );
}
