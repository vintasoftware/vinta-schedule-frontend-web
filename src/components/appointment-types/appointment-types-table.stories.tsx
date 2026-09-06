'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from '@/components/data-table/data-table';
import type { DataTableQuery } from '@/components/data-table/types';
import { DEFAULT_DATA_TABLE_QUERY } from '@/components/data-table/types';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import type { AppointmentType } from '@/client';
import { PERMISSIONS } from '@/lib/permissions';
import { createColumns } from './appointment-types-table';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const ALL_APPOINTMENT_TYPES: AppointmentType[] = [
  {
    id: 1,
    name: 'Engineering',
    description: 'Engineering team calendars',
    slots: [
      { id: 1, name: 'Lead', required_count: 1, calendars: [], pools: [] },
      { id: 2, name: 'Engineer', required_count: 2, calendars: [], pools: [] },
    ],
    public_booking_slug: 'engineering',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: 'Design',
    description: 'Design team calendars',
    slots: [
      { id: 3, name: 'Designer', required_count: 1, calendars: [], pools: [] },
    ],
    public_booking_slug: 'design',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Recruiting',
    slots: [
      { id: 4, name: 'Recruiter', required_count: 1, calendars: [], pools: [] },
      {
        id: 5,
        name: 'Hiring Manager',
        required_count: 1,
        calendars: [],
        pools: [],
      },
      {
        id: 6,
        name: 'Interviewer',
        required_count: 2,
        calendars: [],
        pools: [],
      },
    ],
    public_booking_slug: 'recruiting',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Story wrapper — useState instead of useDataTableQuery; no router needed.
// ---------------------------------------------------------------------------

// Admin so the mint action shows on every row regardless of ownership; an
// empty permission set with no owned calendars is the other fixture used
// below, so the story also covers the row it's absent from — the live table
// renders exactly these four columns (createColumns), not the legacy
// 3-column COLUMNS export, which would otherwise let the story drift from
// production (see SHOULD-FIX 4 in the Phase 1 review).
const ADMIN_PERMISSIONS: readonly string[] = [PERMISSIONS.manageMembers];
const MEMBER_PERMISSIONS: readonly string[] = [];

function AppointmentTypesTableStory({
  data = ALL_APPOINTMENT_TYPES,
  totalCount,
  isLoading = false,
  permissions = ADMIN_PERMISSIONS,
  ownedCalendarIds = new Set<number>(),
}: {
  data?: AppointmentType[];
  totalCount?: number;
  isLoading?: boolean;
  permissions?: readonly string[] | null;
  ownedCalendarIds?: ReadonlySet<number>;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize: 10,
  });

  const count = totalCount ?? data.length;

  const empty = (
    <VStack align='center' gap={2} py={4}>
      <Text color='muted-foreground' size='sm'>
        No appointment types found.
      </Text>
    </VStack>
  );

  const columns = createColumns(
    permissions,
    ownedCalendarIds,
    () => {},
    () => {}
  );

  return (
    <div className='p-6'>
      <DataTable<AppointmentType>
        data={data}
        columns={columns}
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
  title: 'Components/AppointmentTypes/AppointmentTypesTable',
  component: AppointmentTypesTableStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof AppointmentTypesTableStory>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Populated: Story = {
  render: () => <AppointmentTypesTableStory />,
};

export const MintActionAbsentForMember: Story = {
  render: () => (
    <AppointmentTypesTableStory
      permissions={MEMBER_PERMISSIONS}
      ownedCalendarIds={new Set()}
    />
  ),
};

export const Empty: Story = {
  render: () => <AppointmentTypesTableStory data={[]} totalCount={0} />,
};

export const Loading: Story = {
  render: () => <AppointmentTypesTableStory data={[]} isLoading />,
};
