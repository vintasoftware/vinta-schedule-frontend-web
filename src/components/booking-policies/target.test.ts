import { describe, it, expect } from 'vitest';
import type { BookingPolicy } from '@/client';
import {
  buildTargetFields,
  getTargetEntityId,
  getTargetType,
  targetTypeNeedsEntity,
} from './target';

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

describe('getTargetType', () => {
  it('derives the discriminant from the set field', () => {
    expect(getTargetType(policy({ calendar: 5 }))).toBe('calendar');
    expect(getTargetType(policy({ calendar_group: 5 }))).toBe('calendar_group');
    expect(getTargetType(policy({ membership_user_id: 5 }))).toBe('membership');
    expect(getTargetType(policy({ is_organization_default: true }))).toBe(
      'organization_default'
    );
  });
});

describe('getTargetEntityId', () => {
  it('returns the referenced id, or null for the org default', () => {
    expect(getTargetEntityId(policy({ calendar: 7 }))).toBe(7);
    expect(getTargetEntityId(policy({ membership_user_id: 9 }))).toBe(9);
    expect(getTargetEntityId(policy({ is_organization_default: true }))).toBe(
      null
    );
  });
});

describe('targetTypeNeedsEntity', () => {
  it('is true for entity-scoped types, false for org default', () => {
    expect(targetTypeNeedsEntity('calendar')).toBe(true);
    expect(targetTypeNeedsEntity('calendar_group')).toBe(true);
    expect(targetTypeNeedsEntity('membership')).toBe(true);
    expect(targetTypeNeedsEntity('organization_default')).toBe(false);
  });
});

describe('buildTargetFields', () => {
  it('sets exactly one field for entity-scoped types', () => {
    expect(buildTargetFields('calendar', 3)).toEqual({ calendar: 3 });
    expect(buildTargetFields('calendar_group', 3)).toEqual({
      calendar_group: 3,
    });
    expect(buildTargetFields('membership', 3)).toEqual({
      membership_user_id: 3,
    });
  });

  it('sets is_organization_default for the org default', () => {
    expect(buildTargetFields('organization_default', null)).toEqual({
      is_organization_default: true,
    });
  });
});
