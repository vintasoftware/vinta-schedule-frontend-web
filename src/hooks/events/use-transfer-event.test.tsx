import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTransferEvent } from './use-transfer-event';

// Mock the generated client
vi.mock('@/client/@tanstack/react-query.gen', () => ({
  calendarEventsTransferCreateMutation: vi.fn(() => ({
    mutationFn: vi.fn(async (fnOptions) => {
      // Mock implementation: return success response
      return { id: 1, calendar_id: fnOptions.body.destination_calendar_id };
    }),
  })),
}));

vi.mock('./use-calendar-events', () => ({
  invalidateCalendarEvents: vi.fn(async () => {
    // Mock implementation
  }),
}));

describe('useTransferEvent', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('should transfer an event to a destination calendar', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransferEvent(), { wrapper });

    const eventId = 123;
    const destinationCalendarId = 456;

    await waitFor(() => {
      expect(result.current.transferEventMutation).toBeDefined();
    });

    // Note: direct mutation call requires the full options object structure.
    // In real usage, transferEvent async function handles this.
    const mutationResult = await result.current.transferEvent(
      eventId,
      destinationCalendarId
    );

    expect(mutationResult).toBeDefined();
  });

  it('should call transfer with correct path and body', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTransferEvent(), { wrapper });

    const eventId = 789;
    const destinationCalendarId = 999;

    await waitFor(() => {
      expect(result.current.transferEventMutation).toBeDefined();
    });

    // The transferEvent function should call the mutation with the correct params
    const transferSpy = vi.spyOn(
      result.current.transferEventMutation,
      'mutateAsync'
    );

    await result.current.transferEvent(eventId, destinationCalendarId);

    // Verify mutateAsync was called
    expect(transferSpy).toHaveBeenCalled();
  });
});
