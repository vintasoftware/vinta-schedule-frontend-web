'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from '@vinta-schedule/design-system/layout';
import type { Calendar } from '@/client';
import { createColumns } from './calendars-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_CALENDARS: Calendar[] = [
  {
    id: 1,
    name: 'Alice Souza',
    email: 'alice@acme.com',
    external_id: 'ext-1',
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    manage_available_windows: true,
    visibility: 'active',
    sync_enabled: true,
  },
  {
    id: 2,
    name: 'Conference Room A',
    email: 'conf-a@acme.com',
    external_id: 'ext-2',
    provider: 'microsoft',
    calendar_type: 'resource',
    capacity: 10,
    manage_available_windows: false,
    visibility: 'active',
    sync_enabled: true,
  },
  {
    id: 3,
    name: 'Bob Lima',
    email: 'bob@acme.com',
    external_id: 'ext-3',
    provider: 'internal',
    calendar_type: 'personal',
    capacity: null,
    manage_available_windows: true,
    visibility: 'unlisted',
    sync_enabled: false,
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — useState instead of useDataTableQuery; no router needed.
// ---------------------------------------------------------------------------

function CalendarsTableStory({
  data = ALL_CALENDARS,
  totalCount,
  isLoading = false,
}: {
  data?: Calendar[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 10,
  });
  const [pendingRowIds] = React.useState<Set<number>>(new Set());

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendars found.
      </Text>
    </VStack>
  );

  const columns = React.useMemo(
    () =>
      createColumns(
        pendingRowIds,
        async () => {},
        async () => {},
        async () => {},
        async () => {},
        async () => {},
        () => {}
      ),
    [pendingRowIds]
  );

  return (
    <div className='p-6'>
      <DataTable<Calendar>
        data={data}
        columns={columns}
        query={query}
        onQueryChange={setQuery}
        totalCount={count}
        isLoading={isLoading}
        emptyState={empty}
        showSearch={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Calendars/CalendarsTable',
  component: CalendarsTableStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof CalendarsTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Populated: Story = {
  render: () => <CalendarsTableStory />,
};

export const Empty: Story = {
  render: () => <CalendarsTableStory data={[]} totalCount={0} />,
};

export const Loading: Story = {
  render: () => <CalendarsTableStory data={[]} isLoading />,
};
