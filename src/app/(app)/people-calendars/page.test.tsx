import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import PeopleCalendarsPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/people-calendars'),
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
import { calendarList } from '@/client/sdk.gen';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PeopleCalendarsPage />
    </QueryClientProvider>
  );
}

describe('PeopleCalendarsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      replace: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
  });

  it('shows the People calendars header when admin', () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: true,
    } as unknown as ReturnType<typeof useRequireRole>);

    renderPage();

    expect(screen.getByText('People calendars')).toBeInTheDocument();
  });

  it('scopes the calendar list to personal calendars', async () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: true,
    } as unknown as ReturnType<typeof useRequireRole>);

    renderPage();

    // The table fires calendarList with calendar_type=personal.
    await vi.waitFor(() => {
      expect(vi.mocked(calendarList)).toHaveBeenCalled();
    });
    const query = vi.mocked(calendarList).mock.calls[0][0]?.query as {
      calendar_type?: string;
    };
    expect(query?.calendar_type).toBe('personal');
  });

  it('member is gated out of /people-calendars', () => {
    vi.mocked(useRequireRole).mockReturnValue({
      isAllowed: false,
    } as unknown as ReturnType<typeof useRequireRole>);

    renderPage();

    expect(screen.queryByText('People calendars')).not.toBeInTheDocument();
  });
});
