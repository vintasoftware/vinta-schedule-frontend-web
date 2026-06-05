import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventAttendeesEditor } from './event-attendees-editor';
import type {
  EventAttendance,
  EventExternalAttendance,
  ResourceAllocation,
} from '@/client';

// ---------------------------------------------------------------------------
// Query wrapper
// ---------------------------------------------------------------------------

function makeStoryQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function QueryWrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeStoryQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STUB_USER = {
  id: 10,
  email: 'alice@example.com',
  phone_number: '',
  profile: { id: 1, first_name: 'Alice', last_name: 'Smith' },
  is_active: true,
  is_staff: false,
  is_superuser: false,
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  last_login: null,
};

const SAMPLE_INTERNAL: EventAttendance[] = [
  {
    id: 1,
    user: STUB_USER,
    status: 'accepted',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

const SAMPLE_EXTERNAL: EventExternalAttendance[] = [
  {
    id: 2,
    external_attendee: {
      id: 5,
      email: 'bob@external.com',
      name: 'Bob Jones',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    status: 'pending',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

const SAMPLE_RESOURCES: ResourceAllocation[] = [
  {
    id: 3,
    calendar: 20,
    status: 'accepted',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Components/Events/EventAttendeesEditor',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Empty: Story = {
  render: () => (
    <QueryWrapper>
      <EventAttendeesEditor
        eventId={42}
        initialAttendances={[]}
        initialExternalAttendances={[]}
        initialResourceAllocations={[]}
        onSaved={() => console.log('saved')}
      />
    </QueryWrapper>
  ),
};

export const Populated: Story = {
  render: () => (
    <QueryWrapper>
      <EventAttendeesEditor
        eventId={42}
        initialAttendances={SAMPLE_INTERNAL}
        initialExternalAttendances={SAMPLE_EXTERNAL}
        initialResourceAllocations={SAMPLE_RESOURCES}
        onSaved={() => console.log('saved')}
      />
    </QueryWrapper>
  ),
};
