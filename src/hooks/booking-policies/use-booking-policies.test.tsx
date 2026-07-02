import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCreateBookingPolicy,
  useUpdateBookingPolicy,
  useDeleteBookingPolicy,
} from './use-booking-policies';
import * as tanstackModule from '@/client/@tanstack/react-query.gen';

// The hooks spread the generated *Mutation() config (which supplies mutationFn)
// into useMutation, so we mock the mutationFn and assert on the variables it
// receives — same approach as the sync/webhook hook tests.

function mockMutation(
  name:
    | 'bookingPoliciesCreateMutation'
    | 'bookingPoliciesPartialUpdateMutation'
    | 'bookingPoliciesDestroyMutation'
) {
  const mutationFn = vi.fn().mockResolvedValue({ id: 1 });
  vi.spyOn(tanstackModule, name).mockImplementation(
    vi.fn().mockReturnValue({ mutationFn }) as never
  );
  return mutationFn;
}

function renderWithClient<T>(cb: () => T) {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(cb, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCreateBookingPolicy', () => {
  it('sends the body verbatim (exactly-one-target + rule fields)', async () => {
    const mutationFn = mockMutation('bookingPoliciesCreateMutation');
    const { result } = renderWithClient(() => useCreateBookingPolicy());

    await result.current.createBookingPolicy({
      calendar: 42,
      lead_time_seconds: 86400,
      max_horizon_seconds: 0,
      buffer_before_seconds: 600,
      buffer_after_seconds: 1200,
    });

    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    expect(mutationFn.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        body: expect.objectContaining({
          calendar: 42,
          lead_time_seconds: 86400,
        }),
      })
    );
  });
});

describe('useUpdateBookingPolicy', () => {
  it('PATCHes by id with only the rule fields', async () => {
    const mutationFn = mockMutation('bookingPoliciesPartialUpdateMutation');
    const { result } = renderWithClient(() => useUpdateBookingPolicy());

    await result.current.updateBookingPolicy(7, { lead_time_seconds: 3600 });

    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    expect(mutationFn.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        path: { id: '7' },
        body: { lead_time_seconds: 3600 },
      })
    );
  });
});

describe('useDeleteBookingPolicy', () => {
  it('deletes by id', async () => {
    const mutationFn = mockMutation('bookingPoliciesDestroyMutation');
    const { result } = renderWithClient(() => useDeleteBookingPolicy());

    await result.current.deleteBookingPolicy(9);

    await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
    expect(mutationFn.mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: { id: '9' } })
    );
  });
});
