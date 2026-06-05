import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import type { PaginatedOrganizationInvitationList } from '@/client';
import { InvitationsTable } from './invitations-table';

// Mock the navigation hooks used by DataTableQueryBoundary
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/team',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock the invitationsList operation
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    invitationsList: vi.fn(),
  };
});

// Helper to create a consistent query client for stories
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

// Wrapper component that provides QueryClientProvider
function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = makeQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const meta: Meta<typeof InvitationsTable> = {
  title: 'Components/Invitations/InvitationsTable',
  component: InvitationsTable,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <Wrapper>
        <div className='p-6'>
          <Story />
        </div>
      </Wrapper>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof InvitationsTable>;

// Helper to set up the mock response
async function setupMockResponse(
  results: PaginatedOrganizationInvitationList['results']
) {
  const { invitationsList } = await import('@/client/sdk.gen');
  const mockFn = vi.mocked(invitationsList);
  const body: PaginatedOrganizationInvitationList = {
    count: results.length,
    results,
  };
  mockFn.mockResolvedValue({
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof invitationsList>>);
}

/**
 * Populated state — shows multiple pending invitations with email, expiry, and status.
 */
export const Populated: Story = {
  render: () => <InvitationsTable />,
  beforeEach: async () => {
    const invitations: PaginatedOrganizationInvitationList['results'] = [
      {
        id: 1,
        email: 'alice@acme.com',
        first_name: 'Alice',
        last_name: 'Souza',
        organization: 1,
        invited_by: 10,
        accepted_at: null,
        expires_at: '2025-12-31T23:59:59Z',
        created: '2025-06-01T00:00:00Z',
        modified: '2025-06-01T00:00:00Z',
      },
      {
        id: 2,
        email: 'bob@acme.com',
        first_name: 'Bob',
        last_name: 'Lima',
        organization: 1,
        invited_by: 10,
        accepted_at: null,
        expires_at: '2025-12-25T23:59:59Z',
        created: '2025-06-02T00:00:00Z',
        modified: '2025-06-02T00:00:00Z',
      },
      {
        id: 3,
        email: 'carol@acme.com',
        first_name: 'Carol',
        last_name: 'Maia',
        organization: 1,
        invited_by: 10,
        accepted_at: null,
        expires_at: '2025-12-20T23:59:59Z',
        created: '2025-06-03T00:00:00Z',
        modified: '2025-06-03T00:00:00Z',
      },
    ];
    await setupMockResponse(invitations);
  },
};

/**
 * Empty state — shows the empty message when no pending invitations exist.
 */
export const Empty: Story = {
  render: () => <InvitationsTable />,
  beforeEach: async () => {
    await setupMockResponse([]);
  },
};

/**
 * Loading state — shows skeleton rows while data is fetching.
 */
export const Loading: Story = {
  render: () => <InvitationsTable />,
  beforeEach: async () => {
    const { invitationsList } = await import('@/client/sdk.gen');
    const mockFn = vi.mocked(invitationsList);
    // Never resolve — stays in loading state
    mockFn.mockReturnValue(new Promise(() => {}) as never);
  },
};
