import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Calendar, CalendarPool } from '@/client';
import { CreateGroupDialog } from './create-group-dialog';

// ---------------------------------------------------------------------------
// Fixtures — returned for the /calendars/ and /calendar-pools/ fetches so the
// slot pickers render without hitting a live API.
// ---------------------------------------------------------------------------

const MOCK_CALENDARS: Calendar[] = [
  {
    id: 1,
    name: 'Alice Souza',
    email: 'alice@acme.com',
    external_id: 'ext-1',
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    visibility: 'active',
    sync_enabled: true,
  },
  {
    id: 2,
    name: 'Bob Lima',
    email: 'bob@acme.com',
    external_id: 'ext-2',
    provider: 'internal',
    calendar_type: 'personal',
    capacity: null,
    visibility: 'active',
    sync_enabled: true,
  },
  {
    id: 3,
    name: 'Conference Room A',
    email: 'conf-a@acme.com',
    external_id: 'ext-3',
    provider: 'microsoft',
    calendar_type: 'resource',
    capacity: 10,
    visibility: 'active',
    sync_enabled: true,
  },
];

const MOCK_POOLS: CalendarPool[] = [
  {
    id: 7,
    name: 'Nurses',
    description: 'Ward staff on rotation.',
    calendars: [MOCK_CALENDARS[0], MOCK_CALENDARS[1]],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  {
    id: 8,
    name: 'Consult rooms',
    description: '',
    calendars: [MOCK_CALENDARS[2]],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

const MOCK_PAGE = { count: MOCK_CALENDARS.length, results: MOCK_CALENDARS };
const MOCK_POOL_PAGE = { count: MOCK_POOLS.length, results: MOCK_POOLS };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(input: RequestInfo | URL): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  if (url.includes('/calendar-pools/')) {
    return Promise.resolve(jsonResponse(MOCK_POOL_PAGE));
  }
  if (url.includes('/calendars/')) {
    return Promise.resolve(jsonResponse(MOCK_PAGE));
  }
  return Promise.resolve(new Response('{}', { status: 200 }));
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/CalendarGroups/CreateGroupDialog',
  component: CreateGroupDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
  },
  decorators: [
    (Story) => {
      global.fetch = stubFetch as typeof global.fetch;
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof CreateGroupDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
