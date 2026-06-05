import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BundlesTable } from './bundles-table';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/bundles',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    calendarDestroy: vi.fn(),
  };
});

// After mocks, import modules under test.
import { calendarList, calendarDestroy } from '@/client/sdk.gen';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function renderTable() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BundlesTable />, { wrapper });
}

const mockCalendars = [
  {
    id: 1,
    name: 'Personal',
    calendar_type: 'personal' as const,
    email: 'alice@example.com',
    external_id: 'ext-1',
    provider: 'google' as const,
    capacity: null,
    is_active: true,
  },
  {
    id: 2,
    name: 'Conference Room',
    calendar_type: 'resource' as const,
    email: 'conf@example.com',
    external_id: 'ext-2',
    provider: 'google' as const,
    capacity: 10,
    is_active: true,
  },
  {
    id: 3,
    name: 'Main Office Bundle',
    calendar_type: 'bundle' as const,
    email: 'bundle@example.com',
    external_id: 'ext-3',
    provider: 'google' as const,
    capacity: null,
    is_active: true,
  },
  {
    id: 4,
    name: 'Secondary Bundle',
    calendar_type: 'bundle' as const,
    email: 'bundle2@example.com',
    external_id: 'ext-4',
    provider: 'google' as const,
    capacity: null,
    is_active: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BundlesTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(calendarList).mockResolvedValue({
      data: { results: mockCalendars, count: 4 },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);

    vi.mocked(calendarDestroy).mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<ReturnType<typeof calendarDestroy>>);
  });

  it('renders the bundles table', async () => {
    renderTable();
    // Wait for table to load
    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('shows only bundles, filtering out personal and resource calendars', async () => {
    renderTable();
    const mainBundle = await screen.findByText('Main Office Bundle');
    expect(mainBundle).toBeInTheDocument();
    expect(screen.getByText('Secondary Bundle')).toBeInTheDocument();
  });

  it('displays the Name column', async () => {
    renderTable();
    await screen.findByText('Main Office Bundle');
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows empty message when no bundles exist', async () => {
    vi.mocked(calendarList).mockResolvedValue({
      data: { results: [mockCalendars[0], mockCalendars[1]], count: 2 },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);

    renderTable();
    const emptyMessage = await screen.findByText('No bundles created yet.');
    expect(emptyMessage).toBeInTheDocument();
  });

  it('shows delete button for each bundle', async () => {
    renderTable();
    await screen.findByText('Main Office Bundle');

    const deleteButtons = screen.getAllByTestId(/^delete-bundle-/);
    expect(deleteButtons).toHaveLength(2); // 2 bundles
  });

  it('calls calendarDestroy and shows success toast on delete confirm', async () => {
    renderTable();
    await screen.findByText('Main Office Bundle');

    // Find and click the delete button for the first bundle
    const deleteButton = screen.getByTestId('delete-bundle-3');
    fireEvent.click(deleteButton);

    // Confirm the delete in the alert dialog
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Wait for calendarDestroy to be called
    await waitFor(() => {
      expect(vi.mocked(calendarDestroy)).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: '3' },
        })
      );
    });

    // Check success toast was shown
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      'Bundle deleted',
      expect.objectContaining({
        description: 'Main Office Bundle was deleted.',
      })
    );
  });

  it('does not call calendarDestroy when delete is cancelled', async () => {
    renderTable();
    await screen.findByText('Main Office Bundle');

    // Find and click the delete button for the first bundle
    const deleteButton = screen.getByTestId('delete-bundle-3');
    fireEvent.click(deleteButton);

    // Cancel the delete in the alert dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Wait a moment and verify calendarDestroy was NOT called
    await waitFor(() => {
      expect(vi.mocked(calendarDestroy)).not.toHaveBeenCalled();
    });
  });

  it('shows error toast on delete failure', async () => {
    vi.mocked(calendarDestroy).mockRejectedValue(
      new Error('API error: Forbidden')
    );

    renderTable();
    await screen.findByText('Main Office Bundle');

    // Find and click the delete button for the first bundle
    const deleteButton = screen.getByTestId('delete-bundle-3');
    fireEvent.click(deleteButton);

    // Confirm the delete in the alert dialog
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Wait for error toast
    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        'Failed to delete bundle',
        expect.objectContaining({
          description: 'API error: Forbidden',
        })
      );
    });
  });
});
