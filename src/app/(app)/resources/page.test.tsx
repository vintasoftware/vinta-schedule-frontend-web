import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import ResourcesPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/resources'),
  useSearchParams: vi.fn(),
}));

// Mock the role gate
vi.mock('@/components/navigation/role-gate', () => ({
  useRequireRole: vi.fn(() => ({ isAllowed: true })),
}));

// Mock the SDK — the table fetches via calendarList.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(() =>
      Promise.resolve({
        data: { count: 0, results: [] },
        response: new Response(null, { status: 200 }),
      })
    ),
  };
});

import { useRequireRole } from '@/components/navigation/role-gate';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResourcesPage />
    </QueryClientProvider>
  );
}

describe('ResourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      replace: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
  });

  it('shows the Resources header and create button when admin', () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: true,
    } as unknown as ReturnType<typeof useRequireRole>);

    renderPage();

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new resource calendar/i })
    ).toBeInTheDocument();
  });

  it('opens the create dialog when the button is clicked', async () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: true,
    } as unknown as ReturnType<typeof useRequireRole>);

    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: /new resource calendar/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Create a resource calendar')
      ).toBeInTheDocument();
    });
  });

  it('member is gated out of /resources', () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: false,
    } as unknown as ReturnType<typeof useRequireRole>);

    renderPage();

    expect(screen.queryByText('Resources')).not.toBeInTheDocument();
  });
});
