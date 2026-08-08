/**
 * useGroupScopedWindows tests.
 *
 * Covers:
 * - list: group_id/slot_id go through as path params, calendarId filters
 *   the returned rows client-side (the REST endpoint has no calendar_id
 *   query param), and every row is returned when calendarId is omitted.
 * - createWindow / updateWindow: return the write result unwrapped into
 *   `{ window, orphanedBookings }`; each success invalidates the list query.
 * - updateWindow's tri-state rrule_string: omitting the key, passing null,
 *   and passing a string produce three distinguishable request bodies.
 * - deleteWindow: a 204 resolves `{ status: 'deleted' }` and invalidates the
 *   list; a 404 resolves `{ status: 'row_gone' }` (not a rejection) and
 *   still invalidates the list; a 500 rejects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { GroupScopedAvailabilityWindow } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsAvailabilityWindowsList: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsCreate: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsPartialUpdate: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsDestroy: vi.fn(),
  };
});

import {
  calendarGroupsSlotsAvailabilityWindowsList,
  calendarGroupsSlotsAvailabilityWindowsCreate,
  calendarGroupsSlotsAvailabilityWindowsPartialUpdate,
  calendarGroupsSlotsAvailabilityWindowsDestroy,
} from '@/client/sdk.gen';
import {
  useGroupScopedWindows,
  GROUP_SCOPED_WINDOWS_PAGE_SIZE,
} from './use-group-scoped-windows';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWindow(
  overrides: Partial<GroupScopedAvailabilityWindow>
): GroupScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 7,
    start_time: '2026-09-01T09:00:00Z',
    end_time: '2026-09-01T17:00:00Z',
    timezone: 'America/Sao_Paulo',
    rrule_string: null,
    is_recurring: false,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  return { Wrapper, queryClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGroupScopedWindows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('requests the list by group_id/slot_id path params', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsList)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { group_id: 1, slot_id: 10 },
          query: { limit: GROUP_SCOPED_WINDOWS_PAGE_SIZE },
        })
      );
    });

    it('returns every row when calendarId is omitted', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([
          makeWindow({ id: 1, calendar_id: 42 }),
          makeWindow({ id: 2, calendar_id: 43 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.windows.map((w) => w.id)).toEqual([1, 2]);
    });

    it('filters to one calendar client-side when calendarId is set', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([
          makeWindow({ id: 1, calendar_id: 42 }),
          makeWindow({ id: 2, calendar_id: 43 }),
          makeWindow({ id: 3, calendar_id: 42 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10, calendarId: 42 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.windows.map((w) => w.id)).toEqual([1, 3]);
      // The API call itself carries no calendar_id -- the endpoint doesn't
      // support one; filtering happens on the client over the fetched page.
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsList)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { limit: GROUP_SCOPED_WINDOWS_PAGE_SIZE },
        })
      );
    });

    it('isTruncated is false when count <= page size', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue({
        data: {
          count: 150,
          results: Array.from({ length: 150 }, (_, i) =>
            makeWindow({ id: i + 1 })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTruncated).toBe(false);
      expect(result.current.totalCount).toBe(150);
    });

    it('isTruncated is true when count > page size', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue({
        data: {
          count: 250,
          results: Array.from({ length: 200 }, (_, i) =>
            makeWindow({ id: i + 1 })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTruncated).toBe(true);
      expect(result.current.totalCount).toBe(250);
      // The windows array contains only the first 200 rows (one page).
      expect(result.current.windows).toHaveLength(200);
    });

    it('totalCount reflects the whole slot count even when calendarId filter is applied', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue({
        data: {
          count: 300,
          results: Array.from({ length: 200 }, (_, i) =>
            makeWindow({
              id: i + 1,
              calendar_id: i % 2 === 0 ? 42 : 43,
            })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10, calendarId: 42 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // totalCount should still be 300, not the filtered count.
      expect(result.current.totalCount).toBe(300);
      // But windows should be filtered to only calendar 42.
      expect(result.current.windows.every((w) => w.calendar_id === 42)).toBe(
        true
      );
      // And isTruncated reflects that the whole slot exceeds the page size.
      expect(result.current.isTruncated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // createWindow
  // -------------------------------------------------------------------------

  describe('createWindow', () => {
    it('returns the write result unwrapped into { window, orphanedBookings }', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([])
      );
      const createdWindow = makeWindow({ id: 501 });
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockResolvedValue(
        {
          data: {
            window: createdWindow,
            orphaned_bookings: [
              {
                id: 9001,
                calendar_id: 42,
                title: 'Checkup',
                start_time: '2026-09-05T20:00:00-03:00',
                end_time: '2026-09-05T20:30:00-03:00',
              },
            ],
          },
          response: new Response(null, { status: 201 }),
        } as unknown as Awaited<
          ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>
        >
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.createWindow>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.createWindow({
          groupId: 1,
          slotId: 10,
          body: {
            calendar: 42,
            start_time: '2026-09-01T09:00:00Z',
            end_time: '2026-09-01T17:00:00Z',
            timezone: 'America/Sao_Paulo',
          },
        });
      });

      expect(writeResult).toEqual({
        window: createdWindow,
        orphanedBookings: [
          {
            id: 9001,
            calendar_id: 42,
            title: 'Checkup',
            start_time: '2026-09-05T20:00:00-03:00',
            end_time: '2026-09-05T20:30:00-03:00',
          },
        ],
      });
      // The generated shape's snake_case key must not leak through.
      expect(writeResult).not.toHaveProperty('orphaned_bookings');
    });

    it('invalidates the slot list query on success', async () => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockResolvedValue(
        {
          data: { window: makeWindow({}), orphaned_bookings: [] },
          response: new Response(null, { status: 201 }),
        } as unknown as Awaited<
          ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>
        >
      );

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      // Let the hook's own list query settle first, so the query is ACTIVE
      // (an observer is mounted) by the time the mutation invalidates it --
      // an active match is refetched immediately, which is the observable
      // proof of invalidation this test asserts on.
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsList
      ).mock.calls.length;

      await act(async () => {
        await result.current.createWindow({
          groupId: 1,
          slotId: 10,
          body: {
            calendar: 42,
            start_time: '2026-09-01T09:00:00Z',
            end_time: '2026-09-01T17:00:00Z',
            timezone: 'America/Sao_Paulo',
          },
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mock.calls
            .length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateWindow — tri-state rrule_string
  // -------------------------------------------------------------------------

  describe('updateWindow', () => {
    beforeEach(() => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsPartialUpdate
      ).mockResolvedValue({
        data: { window: makeWindow({}), orphaned_bookings: [] },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsPartialUpdate>
      >);
    });

    it('returns the write result unwrapped', async () => {
      const updatedWindow = makeWindow({ id: 501, end_time: '...' });
      vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsPartialUpdate
      ).mockResolvedValue({
        data: { window: updatedWindow, orphaned_bookings: [] },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsPartialUpdate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.updateWindow>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.updateWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
          body: { end_time: '2026-09-01T18:00:00Z' },
        });
      });

      expect(writeResult).toEqual({
        window: updatedWindow,
        orphanedBookings: [],
      });
    });

    it('omitting rrule_string sends a body with no rrule_string key (leaves recurrence unchanged)', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
          body: { end_time: '2026-09-01T18:00:00Z' },
        });
      });

      const call = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsPartialUpdate
      ).mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect('rrule_string' in call.body).toBe(false);
      expect(call.body).toEqual({ end_time: '2026-09-01T18:00:00Z' });
    });

    it('rrule_string: null clears recurrence explicitly', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
          body: { rrule_string: null },
        });
      });

      const call = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsPartialUpdate
      ).mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect('rrule_string' in call.body).toBe(true);
      expect(call.body.rrule_string).toBeNull();
    });

    it('rrule_string: "<RRULE>" sets/replaces recurrence', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
          body: { rrule_string: 'FREQ=WEEKLY;BYDAY=TU' },
        });
      });

      const call = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsPartialUpdate
      ).mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect(call.body.rrule_string).toBe('FREQ=WEEKLY;BYDAY=TU');
    });

    it('invalidates the slot list query on success', async () => {
      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsList
      ).mock.calls.length;

      await act(async () => {
        await result.current.updateWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
          body: {},
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mock.calls
            .length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteWindow
  // -------------------------------------------------------------------------

  describe('deleteWindow', () => {
    beforeEach(() => {
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('resolves { status: "deleted" } on 204 and invalidates the list', async () => {
      vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsDestroy
      ).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsList
      ).mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteWindow>>
        | undefined;
      await act(async () => {
        deleteResult = await result.current.deleteWindow({
          groupId: 1,
          slotId: 10,
          windowId: 501,
        });
      });

      expect(deleteResult).toEqual({ status: 'deleted' });
      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mock.calls
            .length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('resolves { status: "row_gone" } on 404 -- not a rejection', async () => {
      vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsDestroy
      ).mockResolvedValue({
        data: undefined,
        response: new Response(JSON.stringify({ detail: 'Not found.' }), {
          status: 404,
        }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsList
      ).mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteWindow>>
        | undefined;
      let threw = false;
      await act(async () => {
        try {
          deleteResult = await result.current.deleteWindow({
            groupId: 1,
            slotId: 10,
            windowId: 501,
          });
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(false);
      expect(deleteResult).toEqual({ status: 'row_gone' });
      // The row being confirmed gone still means the cached list is stale
      // (it may still list this id) -- refetch so the panel converges.
      await waitFor(() => {
        expect(
          vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mock.calls
            .length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('rejects on a transport failure (500) rather than returning row_gone', async () => {
      vi.mocked(
        calendarGroupsSlotsAvailabilityWindowsDestroy
      ).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 500 }),
      } as unknown as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () => useGroupScopedWindows({ groupId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await expect(
        result.current.deleteWindow({ groupId: 1, slotId: 10, windowId: 501 })
      ).rejects.toThrow();
    });
  });
});
