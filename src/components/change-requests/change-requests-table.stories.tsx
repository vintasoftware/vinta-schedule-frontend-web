'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import type { ExternalEventChangeRequest } from '@/hooks/change-requests/use-change-requests';
// Import canonical columns from the component so they can't drift.
import { createColumns } from './change-requests-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_REQUESTS: ExternalEventChangeRequest[] = [
  {
    id: 1,
    event_id: 101,
    kind: 'update',
    status: 'pending',
    provider: 'google',
    proposed_values: {
      title: 'Sprint review (moved)',
      start_time: '2026-06-20T15:00:00Z',
      end_time: '2026-06-20T16:00:00Z',
    },
    retained_values: {
      title: 'Sprint review',
      start_time: '2026-06-20T14:00:00Z',
      end_time: '2026-06-20T15:00:00Z',
    },
    resolved_by_user_id: null,
    resolved_at: null,
    created: '2026-06-18T09:00:00Z',
  },
  {
    id: 2,
    event_id: 102,
    kind: 'delete',
    status: 'pending',
    provider: 'microsoft',
    proposed_values: {},
    retained_values: { title: '1:1 with Alex' },
    resolved_by_user_id: null,
    resolved_at: null,
    created: '2026-06-18T11:30:00Z',
  },
  {
    id: 3,
    event_id: 103,
    kind: 'update',
    status: 'approved',
    provider: 'apple',
    proposed_values: { title: 'Design sync' },
    retained_values: { title: 'Design' },
    resolved_by_user_id: 5,
    resolved_at: '2026-06-19T08:00:00Z',
    created: '2026-06-17T16:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — plain useState (no useSearchParams) so no router needed.
// ---------------------------------------------------------------------------

function ChangeRequestsTableStory({
  data = ALL_REQUESTS,
  totalCount,
  isLoading = false,
}: {
  data?: ExternalEventChangeRequest[];
  totalCount?: number;
  isLoading?: boolean;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 5,
  });

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No pending change requests.
      </Text>
    </VStack>
  );

  // No-op action handlers for Storybook.
  const columns = React.useMemo(
    () =>
      createColumns(
        new Set(),
        () => {},
        async () => {},
        async () => {}
      ),
    []
  );

  return (
    <div className='p-6'>
      <DataTable<ExternalEventChangeRequest>
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
  title: 'Components/ChangeRequestsTable',
  component: ChangeRequestsTableStory,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChangeRequestsTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Populated — update + delete pending rows plus a resolved row. */
export const Populated: Story = {
  render: () => <ChangeRequestsTableStory />,
};

/** Empty — no requests, custom empty-state visible. */
export const Empty: Story = {
  render: () => <ChangeRequestsTableStory data={[]} totalCount={0} />,
};

/** Loading — skeleton rows while data is fetching. */
export const Loading: Story = {
  render: () => <ChangeRequestsTableStory data={[]} isLoading />,
};
