/**
 * UnsupportedWindowList tests.
 *
 * Covers:
 * - a recurring row's delete confirms before calling the API;
 * - a non-recurring row's delete calls directly, no confirmation;
 * - a viewer without edit rights sees the rows but no delete action.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GroupScopedAvailabilityWindow } from '@/client';
import { UnsupportedWindowList } from './unsupported-window-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsAvailabilityWindowsList: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsDestroy: vi.fn(),
  };
});

import {
  calendarGroupsSlotsAvailabilityWindowsList,
  calendarGroupsSlotsAvailabilityWindowsDestroy,
} from '@/client/sdk.gen';

function makeWindow(
  overrides: Partial<GroupScopedAvailabilityWindow>
): GroupScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 10,
    start_time: '2024-01-02T09:00:00Z',
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    rrule_string: null,
    is_recurring: false,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: GroupScopedAvailabilityWindow[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
  >;
}

function renderList(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        permissions={readOnly ? null : ['organizations.manage_members']}
        ownedCalendarIds={new Set()}
      >
        {children}
      </GroupPermissionsProvider>
    </QueryClientProvider>
  );
  return render(
    <UnsupportedWindowList groupId={1} slotId={10} calendarId={42} />,
    { wrapper }
  );
}

describe('UnsupportedWindowList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a recurring row's delete confirms before calling the API", async () => {
    const recurringUnrepresentable = makeWindow({
      id: 5,
      rrule_string: 'FREQ=DAILY',
      is_recurring: true,
    });
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([recurringUnrepresentable])
    );

    const user = userEvent.setup();
    renderList();

    const row = await screen.findByTestId('unsupported-window-5');
    await user.click(screen.getByRole('button', { name: 'Delete window 5' }));

    // The confirmation dialog is showing; the API must not have been called yet.
    expect(
      await screen.findByText('Delete recurring window')
    ).toBeInTheDocument();
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete series' }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
      ).toHaveBeenCalledTimes(1)
    );
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: '5' }) })
    );
    expect(row).toBeInTheDocument();
  });

  it("a non-recurring row's delete calls the API directly, no confirmation", async () => {
    const oneOff = makeWindow({
      id: 6,
      rrule_string: null,
      is_recurring: false,
    });
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([oneOff])
    );
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy).mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsDestroy>
    >);

    const user = userEvent.setup();
    renderList();

    await screen.findByTestId('unsupported-window-6');
    await user.click(screen.getByRole('button', { name: 'Delete window 6' }));

    // No confirmation dialog for a one-off.
    expect(
      screen.queryByText('Delete recurring window')
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
      ).toHaveBeenCalledTimes(1)
    );
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: '6' }) })
    );
  });

  it('a viewer without edit rights sees the rows but no delete action', async () => {
    const oneOff = makeWindow({ id: 7 });
    const recurring = makeWindow({
      id: 8,
      rrule_string: 'FREQ=DAILY',
      is_recurring: true,
    });
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([oneOff, recurring])
    );

    renderList(true);

    expect(
      await screen.findByTestId('unsupported-window-7')
    ).toBeInTheDocument();
    expect(screen.getByTestId('unsupported-window-8')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete window 7' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete window 8' })
    ).not.toBeInTheDocument();
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).not.toHaveBeenCalled();
  });
});
