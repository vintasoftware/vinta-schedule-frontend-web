import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventsView } from './events-view';
import type { PaginatedCalendarEventList } from '@/client';

// ---------------------------------------------------------------------------
// Static mock data — stories are fully offline; no live API calls.
// ---------------------------------------------------------------------------

const STUB_PARENT = {
  id: 0,
  title: '',
  external_id: '',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '2024-01-01T00:00:00Z',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as const;

const MOCK_EVENTS_PAGE: PaginatedCalendarEventList = {
  count: 3,
  results: [
    {
      id: 1,
      title: 'Design Review',
      start_time: '2024-06-17T10:00:00-04:00',
      end_time: '2024-06-17T11:30:00-04:00',
      timezone: 'America/New_York',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
      external_id: 'evt-1',
      external_attendances: [],
      attendances: [],
      resource_allocations: [],
      parent_recurring_object: STUB_PARENT,
      is_recurring: false,
      is_recurring_instance: false,
    },
    {
      id: 2,
      title: 'Sydney Standup',
      start_time: '2024-06-17T09:00:00+10:00',
      end_time: '2024-06-17T09:30:00+10:00',
      timezone: 'Australia/Sydney',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
      external_id: 'evt-2',
      external_attendances: [],
      attendances: [],
      resource_allocations: [],
      parent_recurring_object: STUB_PARENT,
      is_recurring: false,
      is_recurring_instance: false,
    },
    {
      id: 3,
      title: 'London Check-in',
      start_time: '2024-06-19T09:00:00+01:00',
      end_time: '2024-06-19T09:45:00+01:00',
      timezone: 'Europe/London',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
      external_id: 'evt-3',
      external_attendances: [],
      attendances: [],
      resource_allocations: [],
      parent_recurring_object: STUB_PARENT,
      is_recurring: false,
      is_recurring_instance: false,
    },
  ],
};

const EMPTY_EVENTS_PAGE: PaginatedCalendarEventList = {
  count: 0,
  results: [],
};

// ---------------------------------------------------------------------------
// Fetch stub factory — intercepts all /calendar-events/ requests with static
// data so stories render standalone without hitting any live API.
// ---------------------------------------------------------------------------

function makeStubFetch(page: PaginatedCalendarEventList) {
  return (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/calendar-events/')) {
      return Promise.resolve(
        new Response(JSON.stringify(page), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof EventsView> = {
  title: 'components/Events/EventsView',
  component: EventsView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story, context) => {
      // Each story can supply a `mockPage` parameter; fall back to populated data.
      const mockPage: PaginatedCalendarEventList =
        (context.parameters as { mockPage?: PaginatedCalendarEventList })
          .mockPage ?? MOCK_EVENTS_PAGE;

      // Stub global.fetch for this story — no live network requests.
      global.fetch = makeStubFetch(mockPage) as typeof global.fetch;

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      return (
        <QueryClientProvider client={queryClient}>
          <div className='p-6'>
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof EventsView>;

// Anchor date aligned with the fixture events week (June 17 2024).
const STORY_ANCHOR = new Date('2024-06-17T12:00:00Z');

/**
 * Default — agenda (list) view with three fixture events across different
 * timezones.  All data is served from static mock JSON; no live API calls.
 */
export const Default: Story = {
  args: { initialDate: STORY_ANCHOR },
};

/**
 * Empty — no events in the window (demonstrates the "No events" message).
 */
export const Empty: Story = {
  args: { initialDate: STORY_ANCHOR },
  parameters: {
    mockPage: EMPTY_EVENTS_PAGE,
  },
};

/**
 * Calendar-scoped — filtered to a specific calendar id.
 * The calendarId prop is forwarded to the data hook; the stub returns the
 * same mock data regardless (server-side filtering in real usage).
 */
export const CalendarScoped: Story = {
  args: {
    calendarId: 1,
    initialDate: STORY_ANCHOR,
  },
};

/**
 * Month view — demonstrates the view toggle. The same events from the List
 * view are rendered in the month grid. Use the tabs at the top to switch
 * between List and Month (Phase 14 will add Week).
 */
export const MonthView: Story = {
  args: {
    initialDate: STORY_ANCHOR,
  },
};
