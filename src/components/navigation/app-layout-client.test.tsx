/**
 * buildNavGroups tests — pins the nav shape per role so a revert of the
 * Phase 2 "Calendar groups" nav move (member section) or an accidental
 * widening of the admin-only group would be caught here rather than only
 * visually.
 *
 * The second argument gates the Branding item inside the Admin group. It is
 * unrelated to this phase, but pinned here because both concerns live in
 * `buildNavGroups` and a change to one can silently reshape the other.
 */

import { describe, it, expect } from 'vitest';
import { buildNavGroups } from './app-layout-client';
import { PERMISSIONS } from './permission-gate';

// Capability arrays standing in for the old 'admin' / 'member' roles.
const ADMIN_PERMISSIONS = [
  PERMISSIONS.manageMembers,
  PERMISSIONS.manageOrganization,
  PERMISSIONS.manageBranding,
  PERMISSIONS.manageBilling,
];
const MEMBER_PERMISSIONS: string[] = [];

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe('buildNavGroups', () => {
  it('a member gets a single group containing /groups, no Admin group', () => {
    const groups = buildNavGroups(MEMBER_PERMISSIONS, false);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeUndefined();

    const memberItem = groups[0]?.items.find((item) => item.id === 'groups');
    expect(memberItem).toMatchObject({ id: 'groups', href: '/groups' });

    expect(groups.some((group) => group.label === 'Admin')).toBe(false);
  });

  it('an admin gets the member group plus an unchanged Admin-only group', () => {
    const groups = buildNavGroups(ADMIN_PERMISSIONS, false);

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

  it('appends Branding to the Admin group only when canManageBranding, and never for a member', () => {
    const adminItems = (canManageBranding: boolean) =>
      idsOf(
        buildNavGroups(ADMIN_PERMISSIONS, canManageBranding).find(
          (group) => group.label === 'Admin'
        )?.items ?? []
      );

    expect(adminItems(false)).not.toContain('branding');
    expect(adminItems(true)).toContain('branding');

    // A member has no Admin group at all, so the flag cannot expose branding
    // to them regardless of its value.
    expect(
      buildNavGroups(MEMBER_PERMISSIONS, true).flatMap((group) =>
        idsOf(group.items)
      )
    ).not.toContain('branding');
  });
});
