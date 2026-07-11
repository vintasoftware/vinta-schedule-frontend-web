'use client';

import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DataTable } from './data-table';
import type { DataTableColumn, DataTableQuery } from './types';
import { DEFAULT_DATA_TABLE_QUERY } from './types';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Badge } from '@vinta-schedule/design-system/ui/badge';
import { VStack, HStack } from '@vinta-schedule/design-system/layout';
import { UserPlus } from 'lucide-react';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'member';
  status: 'active' | 'invited' | 'disabled';
}

const ALL_MEMBERS: TeamMember[] = [
  {
    id: 1,
    name: 'Alice Souza',
    email: 'alice@acme.com',
    role: 'admin',
    status: 'active',
  },
  {
    id: 2,
    name: 'Bob Lima',
    email: 'bob@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 3,
    name: 'Carol Maia',
    email: 'carol@acme.com',
    role: 'member',
    status: 'invited',
  },
  {
    id: 4,
    name: 'David Cruz',
    email: 'david@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 5,
    name: 'Eva Pinto',
    email: 'eva@acme.com',
    role: 'member',
    status: 'disabled',
  },
  {
    id: 6,
    name: 'Fábio Neto',
    email: 'fabio@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 7,
    name: 'Gabi Ramos',
    email: 'gabi@acme.com',
    role: 'member',
    status: 'active',
  },
  {
    id: 8,
    name: 'Hélio Costa',
    email: 'helio@acme.com',
    role: 'member',
    status: 'invited',
  },
];

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<
  TeamMember['status'],
  'success' | 'info' | 'danger'
> = {
  active: 'success',
  invited: 'info',
  disabled: 'danger',
};

const COLUMNS: DataTableColumn<TeamMember>[] = [
  {
    accessorKey: 'name',
    id: 'name',
    header: 'Name',
    enableSorting: true,
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  {
    accessorKey: 'email',
    id: 'email',
    header: 'Email',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-muted-foreground'>{row.original.email}</span>
    ),
  },
  {
    accessorKey: 'role',
    id: 'role',
    header: 'Role',
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={row.original.role === 'admin' ? 'default' : 'secondary'}>
        {row.original.role}
      </Badge>
    ),
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: 'Status',
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
];

// ---------------------------------------------------------------------------
// Server-simulation helper
//
// Applies search, ordering, and pagination to the fixture array so the
// Storybook stories behave like a real server-driven table.
// ---------------------------------------------------------------------------

function simulateServer(
  allData: TeamMember[],
  query: DataTableQuery
): { data: TeamMember[]; total: number } {
  let filtered = allData;

  if (query.search) {
    const s = query.search.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.name.toLowerCase().includes(s) || m.email.toLowerCase().includes(s)
    );
  }

  if (query.ordering) {
    const desc = query.ordering.startsWith('-');
    const field = desc
      ? (query.ordering.slice(1) as keyof TeamMember)
      : (query.ordering as keyof TeamMember);
    filtered = [...filtered].sort((a, b) => {
      const av = String(a[field]);
      const bv = String(b[field]);
      return desc ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  }

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const data = filtered.slice(start, start + query.pageSize);
  return { data, total };
}

// ---------------------------------------------------------------------------
// Interactive wrapper
//
// Holds query state internally so the story is self-contained.
// No useSearchParams required in Storybook — we use plain useState.
// ---------------------------------------------------------------------------

function DataTableDemo({
  initialLoading = false,
  forceEmpty = false,
  pageSize = 4,
}: {
  initialLoading?: boolean;
  forceEmpty?: boolean;
  pageSize?: number;
}) {
  const [query, setQuery] = React.useState<DataTableQuery>({
    ...DEFAULT_DATA_TABLE_QUERY,
    pageSize,
  });
  const [isLoading, setIsLoading] = React.useState(initialLoading);

  // Simulate an async data fetch on query changes (0 ms delay in non-loading mode).
  const [serverResult, setServerResult] = React.useState<{
    data: TeamMember[];
    total: number;
  }>({ data: [], total: 0 });

  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
        const result = forceEmpty
          ? { data: [], total: 0 }
          : simulateServer(ALL_MEMBERS, query);
        setServerResult(result);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      const result = forceEmpty
        ? { data: [], total: 0 }
        : simulateServer(ALL_MEMBERS, query);
      setServerResult(result);
    }
  }, [query, isLoading, forceEmpty]);

  const handleQueryChange = (next: DataTableQuery) => {
    setQuery(next);
  };

  return (
    <div className='p-6'>
      <DataTable<TeamMember>
        data={serverResult.data}
        columns={COLUMNS}
        query={query}
        onQueryChange={handleQueryChange}
        totalCount={serverResult.total}
        isLoading={isLoading}
        emptyState={
          <VStack align='center' gap={2} py={4}>
            <p className='text-muted-foreground text-sm'>
              No team members found.
            </p>
            <Button size='sm' variant='outline'>
              <UserPlus className='size-4' />
              Invite a member
            </Button>
          </VStack>
        }
        toolbarActions={
          <Button size='sm'>
            <UserPlus className='size-4' />
            Invite
          </Button>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/DataTable',
  component: DataTable,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Populated table with working sort, search, and pagination. */
export const Populated: Story = {
  render: () => <DataTableDemo />,
};

/** Loading state — skeleton rows shown while data is fetching. */
export const Loading: Story = {
  render: () => <DataTableDemo initialLoading pageSize={4} />,
};

/** Empty state — no rows, custom empty-state slot visible. */
export const Empty: Story = {
  render: () => <DataTableDemo forceEmpty />,
};

/** Full lifecycle: click "Simulate loading" to cycle through loading → populated → empty. */
export const Lifecycle: Story = {
  render: function LifecycleStory() {
    const [phase, setPhase] = React.useState<'populated' | 'loading' | 'empty'>(
      'populated'
    );

    return (
      <VStack>
        {/* Lifecycle controls — bar-style spacing via className escape-hatch */}
        <HStack gap={2} p={4} className='bg-muted/30'>
          <Button
            size='sm'
            variant={phase === 'populated' ? 'default' : 'outline'}
            onClick={() => setPhase('populated')}
          >
            Populated
          </Button>
          <Button
            size='sm'
            variant={phase === 'loading' ? 'default' : 'outline'}
            onClick={() => setPhase('loading')}
          >
            Loading
          </Button>
          <Button
            size='sm'
            variant={phase === 'empty' ? 'default' : 'outline'}
            onClick={() => setPhase('empty')}
          >
            Empty
          </Button>
        </HStack>
        {phase === 'populated' && (
          <DataTableDemo key='populated' pageSize={4} />
        )}
        {phase === 'loading' && (
          <DataTableDemo key='loading' initialLoading pageSize={4} />
        )}
        {phase === 'empty' && (
          <DataTableDemo key='empty' forceEmpty pageSize={4} />
        )}
      </VStack>
    );
  },
};
