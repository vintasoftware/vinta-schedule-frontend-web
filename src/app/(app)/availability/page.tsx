'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { AvailabilityEditor } from '@/components/availability/availability-editor';
import { BlockedTimeForm } from '@/components/availability/blocked-time-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * AvailabilityPage — member route for editing available-time windows and blocked times.
 *
 * No admin gate: any authenticated member can access this route.
 * The backend scopes available-time and blocked-time reads/writes to the calling member.
 *
 * Renders:
 *  - PageHeader "Availability"
 *  - Tabs:
 *    - "Available times" tab: AvailabilityEditor (weekly patterns + ad-hoc dates)
 *    - "Blocked times" tab: BlockedTimeForm (one-off + recurring blocks)
 */
export default function AvailabilityPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Availability'
        description='Set your weekly available hours, one-off windows, and blocked times.'
      />
      <Tabs defaultValue='available' className='w-full'>
        <TabsList>
          <TabsTrigger value='available'>Available times</TabsTrigger>
          <TabsTrigger value='blocked'>Blocked times</TabsTrigger>
        </TabsList>
        <TabsContent value='available'>
          <AvailabilityEditor />
        </TabsContent>
        <TabsContent value='blocked'>
          <BlockedTimeForm />
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
