import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PaginatedSystemUserTokenList } from '@/client';
import { TokensTable, COLUMNS } from './tokens-table';
import type { SystemUserToken } from '@/client';

// Mutable URL state — shared across all mock calls in a single test.
let mockSearchParams = new URLSearchParams();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/api-tokens',
  useSearchParams: () => mockSearchParams,
}));

// Mock the SDK
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicApiTokensList: vi.fn(),
  };
});

import { publicApiTokensList } from '@/client/sdk.gen';

// Helper to render the table with proper setup
function renderTokensTable(toolbarActions?: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<TokensTable toolbarActions={toolbarActions} />, { wrapper });
}

// Helper to make a properly typed paginated response
function makePagedResponse(
  results: SystemUserToken[],
  count = results.length
): Awaited<ReturnType<typeof publicApiTokensList>> {
  const body: PaginatedSystemUserTokenList = { count, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof publicApiTokensList>>;
}

describe('TokensTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  const mockTokens: SystemUserToken[] = [
    {
      id: 1,
      integration_name: 'My Integration',
      is_active: true,
      available_resources: ['calendar', 'calendar_event'],
    },
    {
      id: 2,
      integration_name: 'Other Integration',
      is_active: false,
      available_resources: ['user'],
    },
  ];

  it('renders token metadata rows from a mocked publicApiTokensList', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makePagedResponse(mockTokens, 2)
    );

    renderTokensTable();

    const nameCell = await screen.findByText('My Integration');
    expect(nameCell).toBeInTheDocument();

    const otherCell = screen.getByText('Other Integration');
    expect(otherCell).toBeInTheDocument();
  });

  it('renders scopes column with resource badges (no secret column)', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makePagedResponse(mockTokens, 2)
    );

    renderTokensTable();

    await screen.findByText('My Integration');

    // Scopes from the first token
    expect(screen.getByText('calendar')).toBeInTheDocument();
    expect(screen.getByText('calendar_event')).toBeInTheDocument();

    // No secret column header
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/token value/i)).not.toBeInTheDocument();
  });

  it('renders status badge (Active/Inactive) based on is_active', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makePagedResponse(mockTokens, 2)
    );

    renderTokensTable();

    await screen.findByText('My Integration');

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows empty state when no tokens exist', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makePagedResponse([], 0)
    );

    renderTokensTable();

    const emptyText = await screen.findByText('No API tokens found.');
    expect(emptyText).toBeInTheDocument();
  });

  it('exports COLUMNS with integration_name, available_resources, and is_active columns', () => {
    expect(COLUMNS).toHaveLength(3);
    expect(COLUMNS[0]?.id).toBe('integration_name');
    expect(COLUMNS[1]?.id).toBe('available_resources');
    expect(COLUMNS[2]?.id).toBe('is_active');
  });

  it('renders toolbar actions when provided', async () => {
    vi.mocked(publicApiTokensList).mockResolvedValueOnce(
      makePagedResponse([], 0)
    );

    renderTokensTable(
      <button data-testid='new-token-action'>New token</button>
    );

    await screen.findByText('No API tokens found.');
    expect(screen.getByTestId('new-token-action')).toBeInTheDocument();
  });
});
