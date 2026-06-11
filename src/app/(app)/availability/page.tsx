'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { AvailabilityEditor } from '@/components/availability/availability-editor';
import { BlockedTimeForm } from '@/components/availability/blocked-time-form';
import { UserAvailabilityView } from '@/components/availability/user-availability-view';
import { MyAvailabilityView } from '@/components/availability/my-availability-view';
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
 *    - "My availability" tab (default): MyAvailabilityView (self free/busy, events + blocks)
 *    - "Available times" tab: AvailabilityEditor (weekly patterns + ad-hoc dates)
 *    - "Blocked times" tab: BlockedTimeForm (one-off + recurring blocks)
 *    - "Colleague availability" tab: UserAvailabilityView (free/busy for a colleague,
 *       events-only — blocked times aren't exposed for other users)
 */
export default function AvailabilityPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Availability'
        description='Set your weekly available hours, one-off windows, and blocked times.'
      />
      <Tabs defaultValue='mine' className='w-full'>
        <TabsList>
          <TabsTrigger value='mine'>My availability</TabsTrigger>
          <TabsTrigger value='available'>Available times</TabsTrigger>
          <TabsTrigger value='blocked'>Blocked times</TabsTrigger>
          <TabsTrigger value='colleague'>Colleague availability</TabsTrigger>
        </TabsList>
        <TabsContent value='mine'>
          <MyAvailabilityView />
        </TabsContent>
        <TabsContent value='available'>
          <AvailabilityEditor />
        </TabsContent>
        <TabsContent value='blocked'>
          <BlockedTimeForm />
        </TabsContent>
        <TabsContent value='colleague'>
          <Stack gap={3}>
            <UserAvailabilityView />
          </Stack>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
