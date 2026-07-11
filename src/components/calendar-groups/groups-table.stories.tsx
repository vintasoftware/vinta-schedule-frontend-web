'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from '@vinta-schedule/design-system/layout';
import type { CalendarGroup } from '@/client';
import { COLUMNS } from './groups-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_GROUPS: CalendarGroup[] = [
  {
    id: 1,
    name: 'Engineering',
    description: 'Engineering team calendars',
    slots: [
      { id: 1, name: 'Lead', required_count: 1, calendars: [] },
      { id: 2, name: 'Engineer', required_count: 2, calendars: [] },
    ],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Design',
    description: 'Design team calendars',
    slots: [{ id: 3, name: 'Designer', required_count: 1, calendars: [] }],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Recruiting',
    slots: [
      { id: 4, name: 'Recruiter', required_count: 1, calendars: [] },
      { id: 5, name: 'Hiring Manager', required_count: 1, calendars: [] },
      { id: 6, name: 'Interviewer', required_count: 2, calendars: [] },
    ],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — useState instead of useDataTableQuery; no router needed.
// ---------------------------------------------------------------------------

function GroupsTableStory({
  data = ALL_GROUPS,
  totalCount,
  isLoading = false,
}: {
  data?: CalendarGroup[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 10,
  });

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No calendar groups found.
      </Text>
    </VStack>
  );

  return (
    <div className='p-6'>
      <DataTable<CalendarGroup>
        data={data}
        columns={COLUMNS}
        query={query}
        onQueryChange={setQuery}
        totalCount={count}
        isLoading={isLoading}
        emptyState={empty}
        showSearch={true}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/GroupsTable',
  component: GroupsTableStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof GroupsTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Populated: Story = {
  render: () => <GroupsTableStory />,
};

export const Empty: Story = {
  render: () => <GroupsTableStory data={[]} totalCount={0} />,
};

export const Loading: Story = {
  render: () => <GroupsTableStory data={[]} isLoading />,
};
