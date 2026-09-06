/**
 * useAppointmentTypeScopedBlocks tests.
 *
 * Covers:
 * - list: appointment_type_id/slot_id go through as path params, calendarId filters the
 *   returned rows client-side (the REST endpoint has no calendar_id query
 *   param), and every row is returned when calendarId is omitted.
 * - createBlock / updateBlock: `reason` round-trips through the create and
 *   update bodies and back out of the unwrapped write result; each success
 *   invalidates the list query.
 * - updateBlock's tri-state rrule_string: omitting the key, passing null,
 *   and passing a string produce three distinguishable request bodies —
 *   same contract as the windows hook, proven independently here since this
 *   hook has its own PATCH body construction.
 * - deleteBlock: a 204 resolves `{ status: 'deleted' }` and invalidates the
 *   list; a 404 resolves `{ status: 'row_gone' }` (not a rejection) and
 *   still invalidates the list; a 500 rejects.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import type { AppointmentTypeScopedBlockedTime } from '@/client';

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesSlotsBlockedTimesList: vi.fn(),
    appointmentTypesSlotsBlockedTimesCreate: vi.fn(),
    appointmentTypesSlotsBlockedTimesPartialUpdate: vi.fn(),
    appointmentTypesSlotsBlockedTimesDestroy: vi.fn(),
  };
});

import {
  appointmentTypesSlotsBlockedTimesList,
  appointmentTypesSlotsBlockedTimesCreate,
  appointmentTypesSlotsBlockedTimesPartialUpdate,
  appointmentTypesSlotsBlockedTimesDestroy,
} from '@/client/sdk.gen';
import {
  useAppointmentTypeScopedBlocks,
  APPOINTMENT_TYPE_SCOPED_BLOCKS_PAGE_SIZE,
} from './use-appointment-type-scoped-blocks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeBlock(
  overrides: Partial<AppointmentTypeScopedBlockedTime>
): AppointmentTypeScopedBlockedTime {
  return {
    id: 1,
    calendar_id: 42,
    appointment_type_slot_id: 7,
    start_time: '2026-09-01T09:00:00Z',
    end_time: '2026-09-01T17:00:00Z',
    timezone: 'America/Sao_Paulo',
    reason: '',
    rrule_string: null,
    is_recurring: false,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: AppointmentTypeScopedBlockedTime[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
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

describe('useAppointmentTypeScopedBlocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    it('requests the list by appointment_type_id/slot_id path params', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(
        vi.mocked(appointmentTypesSlotsBlockedTimesList)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { appointment_type_id: 1, slot_id: 10 },
          query: { limit: APPOINTMENT_TYPE_SCOPED_BLOCKS_PAGE_SIZE },
        })
      );
    });

    it('returns every row when calendarId is omitted', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([
          makeBlock({ id: 1, calendar_id: 42 }),
          makeBlock({ id: 2, calendar_id: 43 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blocks.map((b) => b.id)).toEqual([1, 2]);
    });

    it('filters to one calendar client-side when calendarId is set', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([
          makeBlock({ id: 1, calendar_id: 42 }),
          makeBlock({ id: 2, calendar_id: 43 }),
          makeBlock({ id: 3, calendar_id: 42 }),
        ])
      );

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({
            appointmentTypeId: 1,
            slotId: 10,
            calendarId: 42,
          }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.blocks.map((b) => b.id)).toEqual([1, 3]);
    });

    it('isTruncated is true when count > page size', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue({
        data: {
          count: 250,
          results: Array.from({ length: 200 }, (_, i) =>
            makeBlock({ id: i + 1 })
          ),
        },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isTruncated).toBe(true);
      expect(result.current.totalCount).toBe(250);
    });
  });

  // -------------------------------------------------------------------------
  // createBlock
  // -------------------------------------------------------------------------

  describe('createBlock', () => {
    it('round-trips reason through the create body and the unwrapped result', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([])
      );
      const createdBlock = makeBlock({ id: 501, reason: 'Conference' });
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockResolvedValue({
        data: {
          block: createdBlock,
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
        ReturnType<typeof appointmentTypesSlotsBlockedTimesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.createBlock>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.createBlock({
          appointmentTypeId: 1,
          slotId: 10,
          body: {
            calendar: 42,
            start_time: '2026-09-01T09:00:00Z',
            end_time: '2026-09-01T17:00:00Z',
            timezone: 'America/Sao_Paulo',
            reason: 'Conference',
          },
        });
      });

      // The request body carried the reason through untouched.
      expect(
        vi.mocked(appointmentTypesSlotsBlockedTimesCreate)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ reason: 'Conference' }),
        })
      );

      expect(writeResult).toEqual({
        block: createdBlock,
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
      expect(writeResult?.block.reason).toBe('Conference');
    });

    it('invalidates the slot list query on success', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockResolvedValue({
        data: { block: makeBlock({}), orphaned_bookings: [] },
        response: new Response(null, { status: 201 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesCreate>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        appointmentTypesSlotsBlockedTimesList
      ).mock.calls.length;

      await act(async () => {
        await result.current.createBlock({
          appointmentTypeId: 1,
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
          vi.mocked(appointmentTypesSlotsBlockedTimesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateBlock — reason round-trip + tri-state rrule_string
  // -------------------------------------------------------------------------

  describe('updateBlock', () => {
    beforeEach(() => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([])
      );
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue({
        data: { block: makeBlock({}), orphaned_bookings: [] },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesPartialUpdate>
      >);
    });

    it('round-trips an updated reason through the unwrapped result', async () => {
      const updatedBlock = makeBlock({ id: 501, reason: 'Rescheduled' });
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue({
        data: { block: updatedBlock, orphaned_bookings: [] },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesPartialUpdate>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      let writeResult:
        | Awaited<ReturnType<typeof result.current.updateBlock>>
        | undefined;
      await act(async () => {
        writeResult = await result.current.updateBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
          body: { reason: 'Rescheduled' },
        });
      });

      expect(
        vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { reason: 'Rescheduled' },
        })
      );
      expect(writeResult).toEqual({
        block: updatedBlock,
        orphanedBookings: [],
      });
      expect(writeResult?.block.reason).toBe('Rescheduled');
    });

    it('omitting rrule_string sends a body with no rrule_string key (leaves recurrence unchanged)', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
          body: { end_time: '2026-09-01T18:00:00Z' },
        });
      });

      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect('rrule_string' in call.body).toBe(false);
      expect(call.body).toEqual({ end_time: '2026-09-01T18:00:00Z' });
    });

    it('rrule_string: null clears recurrence explicitly', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
          body: { rrule_string: null },
        });
      });

      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect('rrule_string' in call.body).toBe(true);
      expect(call.body.rrule_string).toBeNull();
    });

    it('rrule_string: "<RRULE>" sets/replaces recurrence', async () => {
      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await act(async () => {
        await result.current.updateBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
          body: { rrule_string: 'FREQ=WEEKLY;BYDAY=TU' },
        });
      });

      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as { body: Record<string, unknown> };
      expect(call.body.rrule_string).toBe('FREQ=WEEKLY;BYDAY=TU');
    });

    it('invalidates the slot list query on success', async () => {
      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        appointmentTypesSlotsBlockedTimesList
      ).mock.calls.length;

      await act(async () => {
        await result.current.updateBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
          body: {},
        });
      });

      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsBlockedTimesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteBlock
  // -------------------------------------------------------------------------

  describe('deleteBlock', () => {
    beforeEach(() => {
      vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
        makeListResponse([])
      );
    });

    it('resolves { status: "deleted" } on 204 and invalidates the list', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 204 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        appointmentTypesSlotsBlockedTimesList
      ).mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteBlock>>
        | undefined;
      await act(async () => {
        deleteResult = await result.current.deleteBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
        });
      });

      expect(deleteResult).toEqual({ status: 'deleted' });
      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsBlockedTimesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('resolves { status: "row_gone" } on 404 -- not a rejection', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(JSON.stringify({ detail: 'Not found.' }), {
          status: 404,
        }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();

      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBeforeMutation = vi.mocked(
        appointmentTypesSlotsBlockedTimesList
      ).mock.calls.length;

      let deleteResult:
        | Awaited<ReturnType<typeof result.current.deleteBlock>>
        | undefined;
      let threw = false;
      await act(async () => {
        try {
          deleteResult = await result.current.deleteBlock({
            appointmentTypeId: 1,
            slotId: 10,
            blockId: 501,
          });
        } catch {
          threw = true;
        }
      });

      expect(threw).toBe(false);
      expect(deleteResult).toEqual({ status: 'row_gone' });
      await waitFor(() => {
        expect(
          vi.mocked(appointmentTypesSlotsBlockedTimesList).mock.calls.length
        ).toBeGreaterThan(callsBeforeMutation);
      });
    });

    it('rejects on a transport failure (500) rather than returning row_gone', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(null, { status: 500 }),
      } as unknown as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesDestroy>
      >);

      const { Wrapper } = makeQueryWrapper();
      const { result } = renderHook(
        () =>
          useAppointmentTypeScopedBlocks({ appointmentTypeId: 1, slotId: 10 }),
        { wrapper: Wrapper }
      );

      await expect(
        result.current.deleteBlock({
          appointmentTypeId: 1,
          slotId: 10,
          blockId: 501,
        })
      ).rejects.toThrow();
    });
  });
});
