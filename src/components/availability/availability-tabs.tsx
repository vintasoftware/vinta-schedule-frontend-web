'use client';

/**
 * AvailabilityTabs — the four availability tabs with the active tab tracked on
 * the URL (?tab=mine|available|blocked|colleague). Refreshing or deep-linking
 * lands on the same tab.
 *
 * Must render inside a `<Suspense>` boundary (useUrlState → useSearchParams).
 */

import * as React from 'react';
import { Box } from 'vinta-schedule-design-system/layout/box';
import { Stack } from 'vinta-schedule-design-system/layout/stack';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from 'vinta-schedule-design-system/ui/tabs';
import { useUrlState } from '@/hooks/use-url-state';
import { AvailabilityEditor } from './availability-editor';
import { BlockedTimeForm } from './blocked-time-form';
import { MyAvailabilityView } from './my-availability-view';
import { UserAvailabilityView } from './user-availability-view';

const TABS = ['mine', 'available', 'blocked', 'colleague'] as const;
type TabValue = (typeof TABS)[number];

function isTabValue(value: string): value is TabValue {
  return (TABS as readonly string[]).includes(value);
}

export function AvailabilityTabs() {
  const [tabParam, setTab] = useUrlState('tab', 'mine');
  const value: TabValue = isTabValue(tabParam) ? tabParam : 'mine';

  return (
    // Box's `as` is not generically typed, so it cannot carry Tabs' own props.
    // Wrap instead — the Tabs root is a block element and fills the full width.
    <Box width='full'>
      <Tabs value={value} onValueChange={setTab}>
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
    </Box>
  );
}
