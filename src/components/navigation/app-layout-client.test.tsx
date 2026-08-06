/**
 * buildNavGroups tests — pins the nav shape per role so a revert of the
 * Phase 2 "Calendar groups" nav move (member section) or an accidental
 * widening of the admin-only group would be caught here rather than only
 * visually.
 */

import { describe, it, expect } from 'vitest';
import { buildNavGroups } from './app-layout-client';

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe('buildNavGroups', () => {
  it('a member role gets a single group containing /groups, no Admin group', () => {
    const groups = buildNavGroups('member', false);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeUndefined();

    const memberItem = groups[0]?.items.find((item) => item.id === 'groups');
    expect(memberItem).toMatchObject({ id: 'groups', href: '/groups' });

    expect(groups.some((group) => group.label === 'Admin')).toBe(false);
  });

  it('an admin role gets the member group plus an unchanged Admin-only group', () => {
    const groups = buildNavGroups('admin', false);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBeUndefined();
    expect(idsOf(groups[0]?.items ?? [])).toContain('groups');

    const adminGroup = groups.find((group) => group.label === 'Admin');
    expect(adminGroup).toBeDefined();
    // Pinned against Phase 1: the admin-only set is unchanged by the
    // Phase 2 /groups move — /groups now lives in the base member group,
    // not here.
    expect(idsOf(adminGroup?.items ?? [])).toEqual([
      'team',
      'people-calendars',
      'resources',
      'bundles',
      'booking-policies',
      'sync-settings',
      'api-tokens',
      'webhooks',
    ]);
    expect(idsOf(adminGroup?.items ?? [])).not.toContain('groups');
  });

  it('adds the reseller Branding group only when canInviteOrganizations is true, independent of role', () => {
    expect(
      buildNavGroups('member', false).some((g) => g.label === 'Reseller')
    ).toBe(false);
    expect(
      buildNavGroups('member', true).some((g) => g.label === 'Reseller')
    ).toBe(true);
    expect(
      buildNavGroups('admin', true).some((g) => g.label === 'Reseller')
    ).toBe(true);
  });
});
