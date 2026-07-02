import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCalendarBookingPolicy } from './use-calendar-booking-policy';
import * as listModule from './use-booking-policies';
import type { BookingPolicy } from '@/client';

function policy(overrides: Partial<BookingPolicy>): BookingPolicy {
  return {
    id: 1,
    calendar: null,
    calendar_group: null,
    membership_user_id: null,
    is_organization_default: false,
    lead_time_seconds: 0,
    max_horizon_seconds: 0,
    buffer_before_seconds: 0,
    buffer_after_seconds: 0,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockList(policies: BookingPolicy[], isLoading = false) {
  vi.spyOn(listModule, 'useBookingPolicies').mockReturnValue({
    policies,
    totalCount: policies.length,
    isLoading,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof listModule.useBookingPolicies>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCalendarBookingPolicy', () => {
  it('finds the policy targeting the given calendar', () => {
    mockList([
      policy({ id: 1, calendar: 10 }),
      policy({ id: 2, calendar: 20 }),
    ]);

    const { result } = renderHook(() => useCalendarBookingPolicy(20));

    expect(result.current.policy?.id).toBe(2);
  });

  it('returns null when no policy targets the calendar', () => {
    mockList([policy({ id: 1, calendar: 10 })]);

    const { result } = renderHook(() => useCalendarBookingPolicy(99));

    expect(result.current.policy).toBeNull();
  });

  it('returns null when calendarId is null (dialog closed)', () => {
    mockList([policy({ id: 1, calendar: 10 })]);

    const { result } = renderHook(() => useCalendarBookingPolicy(null));

    expect(result.current.policy).toBeNull();
  });

  it('does not match membership- or group-scoped policies by id collision', () => {
    // A membership policy with membership_user_id 10 must not match calendar 10.
    mockList([policy({ id: 1, membership_user_id: 10, calendar: null })]);

    const { result } = renderHook(() => useCalendarBookingPolicy(10));

    expect(result.current.policy).toBeNull();
  });
});
