import type { Calendar, CalendarPool } from '@/client';

/**
 * Story fixtures shared by the calendar-pool stories, and by the appointment type form
 * story that needs pools to attach. Not used by tests — those build their own
 * narrower fixtures next to the behavior they assert.
 */

export const STORY_CALENDARS: Calendar[] = [
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
    name: 'Carol Dias',
    email: 'carol@acme.com',
    external_id: 'ext-3',
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    visibility: 'active',
    sync_enabled: true,
  },
  {
    id: 4,
    name: 'Conference Room A',
    email: 'conf-a@acme.com',
    external_id: 'ext-4',
    provider: 'microsoft',
    calendar_type: 'resource',
    capacity: 10,
    visibility: 'active',
    sync_enabled: true,
  },
] as Calendar[];

export const STORY_POOLS: CalendarPool[] = [
  {
    id: 7,
    name: 'Nurses',
    description: 'Ward staff on rotation.',
    calendars: [STORY_CALENDARS[0], STORY_CALENDARS[1]],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-06-01T00:00:00Z',
  },
  {
    id: 8,
    name: 'Consult rooms',
    description: '',
    calendars: [STORY_CALENDARS[3]],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-06-01T00:00:00Z',
  },
  {
    id: 9,
    name: 'Everyone',
    description: 'Every calendar in the organization.',
    calendars: STORY_CALENDARS,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-06-01T00:00:00Z',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * A `fetch` stand-in answering the calendar and pool list endpoints, so a story
 * renders its pickers and tables without a live API.
 */
export function makeStoryFetch(pools: CalendarPool[] = STORY_POOLS) {
  return function storyFetch(input: RequestInfo | URL): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/calendar-pools/')) {
      return Promise.resolve(
        jsonResponse({ count: pools.length, results: pools })
      );
    }
    if (url.includes('/calendars/') || url.includes('/calendar/')) {
      return Promise.resolve(
        jsonResponse({
          count: STORY_CALENDARS.length,
          results: STORY_CALENDARS,
        })
      );
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
}
